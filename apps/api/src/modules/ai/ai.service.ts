import type { ModelMessage, Tool } from 'ai'
import type { ModelId } from './ai.config'
import type {
  AiCoreMessage,
  AiGenerateOptions,
  AiStreamEvent,
  AiStreamRequest,
  ChatInput,
  ChatResult,
  GenerateObjectInput,
  GenerateObjectResult,
  GenerateTextInput,
  GenerateTextResult,
} from './contracts/ai.contract'
import { generateText, stepCountIs, streamText } from 'ai'
import { Elysia } from 'elysia'
import { modelConfigBase, modelRegistry } from './ai.config'
import {
  createSchemaPromptCommand,
  createSchemaPromptCommandForChat,
  extractToolCalls,
  extractToolResults,
  getModelInstance,
  validateAndParse,
} from './ai.utils'
import { langfuseService } from './langfuse.service'
import { buildTelemetryOptions, buildTraceId, buildUsageStats } from './telemetry.utils'

export interface StreamGeneratorInput extends AiStreamRequest {
  tools?: Record<string, Tool>
}

// Service-level return types with AbortController (not serializable, internal use only)
export type GenerateTextServiceResult = GenerateTextResult & {
  abortController?: AbortController
}

export type GenerateObjectServiceResult<T> = GenerateObjectResult<T> & {
  abortController?: AbortController
}

export type ChatServiceResult = ChatResult & {
  abortController?: AbortController
}

const DEFAULT_STOPWHEN = 10

export const aiService = new Elysia({ name: 'Ai.Service' })
  .use(langfuseService)
  .derive({ as: 'scoped' }, ({ langfuseService }) => {
    const logger = console

    const registerDefaultModels = () => {
      for (const [modelId, modelConfig] of Object.entries(modelConfigBase)) {
        modelRegistry.register(modelId as ModelId, modelConfig)
        logger.log(`Registered model: ${modelId}`)
      }
    }

    registerDefaultModels()

    const executeGeneration = async (generateOptions: Parameters<typeof generateText>[0], traceId?: string, options?: AiGenerateOptions) => {
      if (traceId && langfuseService) {
        return langfuseService.executeTracedGeneration(generateOptions, options)
      }
      return generateText(generateOptions)
    }

    const executeStreaming = async (streamOptions: Parameters<typeof streamText>[0], traceId?: string, options?: AiGenerateOptions) => {
      if (traceId && langfuseService) {
        return langfuseService.executeTracedStreaming(streamOptions, options)
      }
      return streamText(streamOptions)
    }

    const generateTextMethod = async ({
      prompt,
      model,
      options,
      signal,
    }: GenerateTextInput): Promise<GenerateTextServiceResult> => {
      const abortController = signal ? undefined : new AbortController()
      const abortSignal = signal || abortController!.signal
      const modelInstance = await getModelInstance(model)
      const traceId = await buildTraceId(options)

      const generateOptions: Parameters<typeof generateText>[0] = {
        model: modelInstance,
        prompt,
        abortSignal,
        ...options,
        stopWhen: stepCountIs(options?.stopWhen ?? DEFAULT_STOPWHEN),
        experimental_telemetry: buildTelemetryOptions(options, traceId, 'ai.generateText'),
      }

      const result = await executeGeneration(generateOptions, traceId, options)

      return {
        result: result.text,
        usage: buildUsageStats(result.usage),
        finishReason: result.finishReason,
        abortController,
      }
    }

    const generateObject = async <T>({
      prompt,
      schema,
      model,
      options,
      signal,
    }: GenerateObjectInput<T>): Promise<GenerateObjectServiceResult<T>> => {
      const abortController = signal ? undefined : new AbortController()
      const abortSignal = signal || abortController!.signal
      const modelInstance = await getModelInstance(model)
      const traceId = await buildTraceId(options)

      const schemaPrompt = createSchemaPromptCommand(schema)
      const fullPrompt = `${prompt}\n${schemaPrompt}`

      const generateOptions: Parameters<typeof generateText>[0] = {
        model: modelInstance,
        prompt: fullPrompt,
        abortSignal,
        ...options,
        stopWhen: stepCountIs(options?.stopWhen ?? DEFAULT_STOPWHEN),
        experimental_telemetry: buildTelemetryOptions(options, traceId, 'ai.generateObject'),
      }

      const result = await executeGeneration(generateOptions, traceId, options)

      let parsed: T
      try {
        parsed = validateAndParse(result.text, schema)
      }
      catch (error) {
        logger.error('Schema validation failed', error)
        throw new Error(`Schema validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }

      return {
        result: parsed,
        usage: buildUsageStats(result.usage),
        finishReason: result.finishReason,
        abortController,
      }
    }

    const chat = async ({
      messages,
      schema,
      tools,
      model,
      options,
      signal,
    }: ChatInput): Promise<ChatServiceResult> => {
      const abortController = signal ? undefined : new AbortController()
      const abortSignal = signal || abortController!.signal
      const modelInstance = await getModelInstance(model)
      const traceId = await buildTraceId(options)

      const newHistory: AiCoreMessage[] = schema
        ? [
            ...messages.slice(0, -1),
            { role: 'assistant' as const, content: createSchemaPromptCommandForChat(schema), metadata: { isConsideredSystemMessage: true } },
            ...messages.slice(-1),
          ]
        : [...messages]

      const generateOptions: Parameters<typeof generateText>[0] = {
        model: modelInstance,
        messages: newHistory as ModelMessage[],
        abortSignal,
        ...options,
        tools,
        stopWhen: stepCountIs(options?.stopWhen ?? DEFAULT_STOPWHEN),
        experimental_telemetry: buildTelemetryOptions(options, traceId, 'ai.chat'),
      }

      const result = await executeGeneration(generateOptions, traceId, options)

      if (schema) {
        try {
          validateAndParse(result.text, schema)
        }
        catch (error) {
          logger.error('Schema validation failed in chat', error)
          throw new Error(`Schema validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

      const lastStepUsage = buildUsageStats(result.totalUsage)

      const updatedMessages: AiCoreMessage[] = [
        ...newHistory,
        {
          role: 'assistant',
          content: result.text,
          metadata: {
            usage: lastStepUsage,
            finishReason: result.finishReason,
            timestamp: new Date().toISOString(),
            toolCalls: extractToolCalls(result.steps),
            reasonning: result.reasoningText,
          },
        },
      ]

      return {
        result: result.text,
        messages: updatedMessages,
        usage: lastStepUsage,
        finishReason: result.finishReason,
        toolCalls: extractToolCalls(result.steps),
        toolResults: extractToolResults(result.steps),
        abortController,
      }
    }

    async function* streamTextGenerator({
      prompt,
      messages,
      model,
      options,
      tools,
    }: StreamGeneratorInput, signal?: AbortSignal): AsyncGenerator<AiStreamEvent> {
      const abortController = signal ? undefined : new AbortController()
      const abortSignal = signal || abortController!.signal

      const modelInstance = await getModelInstance(model)

      let conversationMessages: AiCoreMessage[] = []
      let hasMessages = false

      if (messages && messages.length > 0) {
        conversationMessages = [...messages] as AiCoreMessage[]
        hasMessages = true
      }
      else if (prompt) {
        conversationMessages = [{ role: 'user', content: prompt }]
      }
      else {
        throw new Error('Either prompt or messages must be provided')
      }

      const traceId = await buildTraceId(options)

      const streamOptionsBase: Omit<Parameters<typeof streamText>[0], 'messages' | 'prompt'> = {
        model: modelInstance,
        abortSignal,
        ...options,
        tools,
        stopWhen: stepCountIs(options?.stopWhen ?? DEFAULT_STOPWHEN),
        experimental_telemetry: buildTelemetryOptions(options, traceId, 'ai.streamText'),
      }

      const streamOptions: Parameters<typeof streamText>[0] = hasMessages
        ? {
            ...streamOptionsBase,
            messages: conversationMessages as ModelMessage[],
          }
        : {
            ...streamOptionsBase,
            prompt: conversationMessages[0]?.content || '',
          }

      const result = await executeStreaming(streamOptions, traceId, options)

      let fullText = ''

      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') {
          fullText += part.text
          yield { type: 'chunk' as const, text: part.text }
        }
        else if (part.type === 'tool-call') {
          yield {
            type: 'tool-call' as const,
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            args: part.input as Record<string, unknown>,
          }
        }
        else if (part.type === 'tool-result') {
          yield {
            type: 'tool-result' as const,
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            result: part.output,
          }
        }
      }

      const usage = await result.usage
      const finishReason = await result.finishReason

      const final = {
        type: 'done' as const,
        fullText,
        usage: usage
          ? {
              promptTokens: usage.inputTokens ?? 0,
              completionTokens: usage.outputTokens ?? 0,
              totalTokens: usage.totalTokens ?? ((usage.inputTokens ?? 0) + (usage.outputTokens ?? 0)),
            }
          : undefined,
        finishReason,
      }

      yield final

      return final
    }

    return {
      aiService: {
        generateText: generateTextMethod,
        generateObject,
        chat,
        streamTextGenerator,
      },
    }
  })
