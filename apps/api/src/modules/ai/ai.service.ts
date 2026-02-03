import type { LanguageModel, LanguageModelUsage, ModelMessage, Tool } from 'ai'
import type { ModelId } from './ai.config'
import type {
  AiGenerateInput,
  AiGenerateInputWithoutSchema,
  AiGenerateInputWithSchema,
  AiGenerateOptions,
  AiGenerateOutputObject,
  AiGenerateOutputText,
  AiStreamEvent,
  AiStreamRequest,
  CoreMessage,
} from './contracts/ai.contract'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { generateText, stepCountIs, streamText } from 'ai'
import z from 'zod'
import { modelConfigBase, modelRegistry } from './ai.config'
import { getDefaultModel, getModel, sanitizeAiJson } from './ai.utils'
import { LangfuseService } from './langfuse.service'

export interface StreamGeneratorInput extends AiStreamRequest {
  tools?: Record<string, Tool>
}

const defaultStopWhen = 10

export type AiGenerateResultText = AiGenerateOutputText & {
  abortController?: AbortController
}

export type AiGenerateResultObject<T> = AiGenerateOutputObject<T> & {
  abortController?: AbortController
}

export type AiGenerateResult<T = string> = AiGenerateResultText | AiGenerateResultObject<T>

function createSchemaPromptCommand(schema: z.ZodType): string {
  return `
  
  IMPORTANT: You must respond with valid JSON that matches the expected schema structure.
  Your response must be valid JSON only, with no additional text, markdown formatting, or explanation before or after the JSON. Return only the JSON object or array.
  
  The schema is:
  ${JSON.stringify(schema.toJSONSchema(), null, 2)}
  `
}

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name)

  constructor(private readonly langfuseService: LangfuseService) {}

  onModuleInit() {
    this.registerDefaultModels()
  }

  static async createTraceId(seed: string): Promise<string> {
    return LangfuseService.createTraceId(seed)
  }

  async getLangfusePrompt(promptName: string, promptLabel?: string, version?: number) {
    return this.langfuseService.getLangfusePrompt(promptName, promptLabel, version)
  }

  private registerDefaultModels() {
    for (const [modelId, modelConfig] of Object.entries(modelConfigBase)) {
      modelRegistry.register(modelId as ModelId, modelConfig)
      this.logger.log(`Registered model: ${modelId}`)
    }
  }

  private async getModelInstance(modelId?: ModelId): Promise<LanguageModel> {
    if (modelId) {
      return getModel(modelId)
    }
    const defaultModel = await getDefaultModel()
    if (!defaultModel) {
      throw new Error('No default model configured. Please specify a model or configure a default model.')
    }
    return defaultModel
  }

  private createSchemaPrompt(schema: z.ZodType): string {
    return createSchemaPromptCommand(schema)
  }

  private validateAndParse<T>(text: string, schema: z.ZodType<T>): T {
    const parsed = sanitizeAiJson(text)
    return schema.parse(parsed)
  }

  /**
   * Generates AI completion using the Vercel AI SDK.
   * Supports both single-turn prompts and multi-turn conversations.
   *
   * @template T - The expected output type when using a Zod schema for structured output
   *
   * @param input - The generation input configuration
   * @param input.prompt - Single-turn prompt string (mutually exclusive with messages)
   * @param input.messages - Conversation history as CoreMessage[] (mutually exclusive with prompt)
   * @param input.model - Optional model identifier. Falls back to the default configured model
   * @param input.options - Generation options (temperature, maxTokens, telemetry, etc.)
   * @param input.schema - Optional Zod schema for structured JSON output. When provided, the response is validated and parsed
   * @param input.tools - Optional tools (functions) the model can call during generation
   * @param input.signal - Optional AbortSignal for request cancellation. If not provided, an AbortController is created internally
   *
   * @returns When no schema is provided, returns {@link AiGenerateResultText} with the raw text result.
   *          When a schema is provided, returns {@link AiGenerateResultObject} with the parsed and validated object.
   *          Both include usage stats, finish reason, updated messages (for conversations), tool calls/results, and an optional AbortController.
   *
   * @throws Error if neither prompt nor messages is provided
   * @throws Error if schema validation fails when a schema is specified
   *
   * @example
   * // Simple text generation
   * const result = await aiService.generate({ prompt: 'Hello, world!' })
   * console.log(result.result) // string
   *
   * @example
   * // Structured output with Zod schema
   * const schema = z.object({ name: z.string(), age: z.number() })
   * const result = await aiService.generate({ prompt: 'Generate a user', schema })
   * console.log(result.result) // { name: string, age: number }
   *
   * @example
   * // Multi-turn conversation
   * const result = await aiService.generate({
   *   messages: [
   *     { role: 'system', content: 'You are a helpful assistant.' },
   *     { role: 'user', content: 'What is TypeScript?' },
   *   ],
   * })
   * console.log(result.messages) // Updated conversation with assistant response
   */
  async generate(input: AiGenerateInputWithoutSchema): Promise<AiGenerateResultText>
  async generate<T>(input: AiGenerateInputWithSchema<T>): Promise<AiGenerateResultObject<T>>
  async generate<T>(input: AiGenerateInput<T>): Promise<AiGenerateResult<T>>
  async generate<T>({
    prompt,
    messages,
    model,
    options,
    schema,
    tools,
    signal,
  }: AiGenerateInput<T>): Promise<AiGenerateResult<T>> {
    const abortController = signal ? undefined : new AbortController()
    const abortSignal = signal || abortController!.signal

    const modelInstance = await this.getModelInstance(model)

    // Build messages array - messages takes precedence over prompt
    let conversationMessages: CoreMessage[] = []
    let hasMessages = false

    if (messages && messages.length > 0) {
      // Use provided messages (conversation history)
      conversationMessages = [...messages] as CoreMessage[]
      hasMessages = true
    }
    else if (prompt) {
      // Convert prompt to single user message (backward compatibility)
      conversationMessages = [{ role: 'user', content: prompt }]
    }
    else {
      throw new Error('Either prompt or messages must be provided')
    }

    // Handle schema prompt - append to system message if exists, otherwise create/update system message
    if (schema) {
      const schemaPrompt = this.createSchemaPrompt(schema)
      const systemMessageIndex = conversationMessages.findIndex(m => m.role === 'system')

      if (systemMessageIndex >= 0) {
        // Append to existing system message
        conversationMessages[systemMessageIndex] = {
          ...conversationMessages[systemMessageIndex],
          content: conversationMessages[systemMessageIndex].content + schemaPrompt,
        }
      }
      else {
        // Create new system message with schema instructions
        conversationMessages.unshift({
          role: 'system',
          content: schemaPrompt.trim(),
        })
      }
    }

    // Create trace id for telemetry if telemetry is enabled
    const traceId = options?.telemetry ? await LangfuseService.createTraceId(options?.telemetry?.langfuseTraceName) : undefined

    // Build generate options - use separate branches for messages vs prompt to satisfy TypeScript
    const generateOptionsBase: Omit<Parameters<typeof generateText>[0], 'messages' | 'prompt'> = {
      model: modelInstance,
      abortSignal,
      ...options,
      tools,
      stopWhen: stepCountIs(options?.stopWhen ?? defaultStopWhen),
      experimental_telemetry: {
        isEnabled: true,
        recordInputs: true,
        recordOutputs: true,
        ...(options?.telemetry && {
          langfuseTraceName: options.telemetry.langfuseTraceName || 'ai.generate',
          traceId,
          functionId: options.telemetry.functionId || '',
          langfuseOriginalPrompt: options.telemetry.langfuseOriginalPrompt || '',
        }),
      },
    }

    const generateOptions: Parameters<typeof generateText>[0] = hasMessages
      ? {
          ...generateOptionsBase,
          messages: conversationMessages as ModelMessage[],
        }
      : {
          ...generateOptionsBase,
          prompt: conversationMessages[0]?.content || '',
        }

    const result = await this.executeGeneration(generateOptions, traceId, options)

    let parsed: T | undefined
    if (schema) {
      try {
        parsed = this.validateAndParse(result.text, schema)
      }
      catch (error) {
        this.logger.error('Schema validation failed', error)
        throw new Error(`Schema validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    const updatedMessages: CoreMessage[] | undefined = hasMessages && conversationMessages
      ? [
          ...conversationMessages,
          { role: 'assistant', content: result.text },
        ]
      : undefined

    let usage: { promptTokens: number, completionTokens: number, totalTokens: number } | undefined

    if (result.usage) {
      const usageAny = result.usage as LanguageModelUsage
      usage = {
        promptTokens: usageAny.inputTokens ?? 0,
        completionTokens: usageAny.outputTokens ?? 0,
        totalTokens: result.usage.totalTokens ?? (usageAny.inputTokens ?? 0) + (usageAny.outputTokens ?? 0),
      }
    }

    const toolCalls = result.steps?.flatMap(step =>
      (step.toolCalls || []).map((tc) => {
        const toolCall = tc
        return {
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.toolName,
          args: toolCall.input as Record<string, unknown>,
        }
      }),
    )
    const toolResults = result.steps?.flatMap(step =>
      (step.toolResults || []).map((tr) => {
        const toolResult = tr
        return {
          toolCallId: toolResult.toolCallId,
          toolName: toolResult.toolName,
          result: toolResult.output,
        }
      }),
    )

    const baseResponse = {
      usage,
      finishReason: result.finishReason,
      abortController,
      ...(hasMessages && updatedMessages && updatedMessages.length > 0 && { messages: updatedMessages }),
      ...(toolCalls && toolCalls.length > 0 && { toolCalls }),
      ...(toolResults && toolResults.length > 0 && { toolResults }),
    }

    if (parsed !== undefined) {
      return {
        ...baseResponse,
        type: 'object' as const,
        result: parsed,
      }
    }
    else {
      return {
        ...baseResponse,
        type: 'text' as const,
        result: result.text,
      }
    }
  }

  private async executeGeneration(generateOptions: Parameters<typeof generateText>[0], traceId?: string, options?: AiGenerateOptions) {
    // If traceId is provided, execute the generation in a langfuse traced context
    if (traceId) {
      return this.langfuseService.executeTracedGeneration(generateOptions, options)
    }

    return generateText(generateOptions)
  }

  /**
   * Streams AI text generation using the Vercel AI SDK.
   * Yields {@link AiStreamEvent} items: text chunks, tool calls, tool results, and a final done event.
   *
   * @param input - The streaming input configuration
   * @param input.prompt - Single-turn prompt string (mutually exclusive with messages)
   * @param input.messages - Conversation history as CoreMessage[] (mutually exclusive with prompt)
   * @param input.model - Optional model identifier. Falls back to the default configured model
   * @param input.options - Generation options (temperature, maxTokens, telemetry, etc.)
   * @param input.tools - Optional tools (functions) the model can call during streaming
   * @param signal - Optional AbortSignal for cancelling the stream
   *
   * @yields {@link AiStreamEvent} - Discriminated union: `chunk` (text delta), `tool-call`, `tool-result`, `done` (with fullText, usage, finishReason), or `error`
   *
   * @throws Error if neither prompt nor messages is provided
   *
   * @example
   * // Simple streaming
   * for await (const event of aiService.streamTextGenerator({ prompt: 'Tell me a story' })) {
   *   if (event.type === 'chunk') console.log(event.text)
   *   if (event.type === 'done') console.log(event.fullText, event.usage)
   * }
   *
   * @example
   * // Multi-turn conversation with tools
   * for await (const event of aiService.streamTextGenerator(
   *   { messages: [{ role: 'user', content: 'Hello' }], tools: { search: searchTool } },
   *   abortSignal
   * )) {
   *   if (event.type === 'tool-call') handleToolCall(event)
   *   if (event.type === 'done') console.log(event.fullText)
   * }
   */
  async* streamTextGenerator({
    prompt,
    messages,
    model,
    options,
    tools,
  }: StreamGeneratorInput, signal?: AbortSignal): AsyncGenerator<AiStreamEvent> {
    const abortController = signal ? undefined : new AbortController()
    const abortSignal = signal || abortController!.signal

    const modelInstance = await this.getModelInstance(model)

    // Build messages array - messages takes precedence over prompt
    let conversationMessages: CoreMessage[] = []
    let hasMessages = false

    if (messages && messages.length > 0) {
      conversationMessages = [...messages] as CoreMessage[]
      hasMessages = true
    }
    else if (prompt) {
      conversationMessages = [{ role: 'user', content: prompt }]
    }
    else {
      throw new Error('Either prompt or messages must be provided')
    }

    const traceId = options?.telemetry ? await LangfuseService.createTraceId(options?.telemetry?.langfuseTraceName) : undefined

    const streamOptionsBase: Omit<Parameters<typeof streamText>[0], 'messages' | 'prompt'> = {
      model: modelInstance,
      abortSignal,
      ...options,
      tools,
      stopWhen: stepCountIs(options?.stopWhen ?? defaultStopWhen),
      experimental_telemetry: {
        isEnabled: true,
        recordInputs: true,
        recordOutputs: true,
        ...(options?.telemetry && {
          langfuseTraceName: options.telemetry.langfuseTraceName || 'ai.streamText',
          traceId,
          functionId: options.telemetry.functionId || '',
          langfuseOriginalPrompt: options.telemetry.langfuseOriginalPrompt || '',
        }),
      },
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

    const result = await this.executeStreaming(streamOptions, traceId, options)

    let fullText = ''

    // Use fullStream to capture all events including tool calls
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

  private async executeStreaming(streamOptions: Parameters<typeof streamText>[0], traceId?: string, options?: AiGenerateOptions) {
    if (traceId) {
      return this.langfuseService.executeTracedStreaming(streamOptions, options)
    }

    return streamText(streamOptions)
  }
}
