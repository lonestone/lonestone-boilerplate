import type { LanguageModel, LanguageModelUsage, ModelMessage } from 'ai'
import type { ModelId } from './ai.config'
import type { AiGenerateInput, AiGenerateInputWithoutSchema, AiGenerateInputWithSchema, AiGenerateOptions, AiGenerateOutputObject, AiGenerateOutputText, CoreMessage } from './contracts/ai.contract'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { generateText, stepCountIs } from 'ai'
import z from 'zod'
import { modelConfigBase, modelRegistry } from './ai.config'
import { getDefaultModel, getModel, sanitizeAiJson } from './ai.utils'
import { LangfuseService } from './langfuse.service'

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

    const traceId = options?.telemetry ? await LangfuseService.createTraceId(options?.telemetry?.traceName) : undefined

    // Build generate options - use separate branches for messages vs prompt to satisfy TypeScript
    const generateOptionsBase: Omit<Parameters<typeof generateText>[0], 'messages' | 'prompt'> = {
      model: modelInstance,
      abortSignal,
      ...(options?.temperature !== undefined && { temperature: options.temperature }),
      ...(options?.topP !== undefined && { topP: options.topP }),
      ...(options?.frequencyPenalty !== undefined && { frequencyPenalty: options.frequencyPenalty }),
      ...(options?.presencePenalty !== undefined && { presencePenalty: options.presencePenalty }),
      ...(options?.maxTokens !== undefined && { maxTokens: options.maxTokens }),
      ...(tools && { tools }),
      ...(options?.maxSteps !== undefined && { maxSteps: options.maxSteps }),
      stopWhen: stepCountIs(options?.stopWhen ?? defaultStopWhen),
      experimental_telemetry: {
        isEnabled: true,
        recordInputs: true,
        recordOutputs: true,
        ...(options?.telemetry && {
          traceName: options.telemetry.traceName || 'ai.generate',
          traceId,
          functionId: options.telemetry.functionId || '',
          originalPrompt: options.telemetry.langfuseOriginalPrompt || '',
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
}
