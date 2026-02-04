import type { LanguageModel, LanguageModelUsage, ModelMessage, Tool } from 'ai'
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
  TokenUsage,
  ToolCall,
  ToolResult,
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

const defaultStopWhen = 10

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

  // ============================================================================
  // Shared Private Methods
  // ============================================================================

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

  private async buildTraceId(options?: AiGenerateOptions): Promise<string | undefined> {
    if (!options?.telemetry) {
      return undefined
    }
    return LangfuseService.createTraceId(options.telemetry.langfuseTraceName)
  }

  private buildTelemetryOptions(options?: AiGenerateOptions, traceId?: string, defaultTraceName = 'ai.generate') {
    return {
      isEnabled: true,
      recordInputs: true,
      recordOutputs: true,
      ...(options?.telemetry && {
        langfuseTraceName: options.telemetry.langfuseTraceName || defaultTraceName,
        traceId,
        functionId: options.telemetry.functionId || '',
        langfuseOriginalPrompt: options.telemetry.langfuseOriginalPrompt || '',
      }),
    }
  }

  private buildUsageStats(usage: LanguageModelUsage | undefined): TokenUsage | undefined {
    if (!usage) {
      return undefined
    }
    return {
      promptTokens: usage.inputTokens ?? 0,
      completionTokens: usage.outputTokens ?? 0,
      totalTokens: usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
    }
  }

  private extractToolCalls(steps: Awaited<ReturnType<typeof generateText>>['steps'] | undefined): ToolCall[] | undefined {
    const toolCalls = steps?.flatMap(step =>
      (step.toolCalls || []).map(tc => ({
        toolCallId: tc.toolCallId,
        toolName: tc.toolName,
        args: tc.input as Record<string, unknown>,
      })),
    )
    return toolCalls && toolCalls.length > 0 ? toolCalls : undefined
  }

  private extractToolResults(steps: Awaited<ReturnType<typeof generateText>>['steps'] | undefined): ToolResult[] | undefined {
    const toolResults = steps?.flatMap(step =>
      (step.toolResults || []).map(tr => ({
        toolCallId: tr.toolCallId,
        toolName: tr.toolName,
        result: tr.output,
      })),
    )
    return toolResults && toolResults.length > 0 ? toolResults : undefined
  }

  private async executeGeneration(generateOptions: Parameters<typeof generateText>[0], traceId?: string, options?: AiGenerateOptions) {
    if (traceId) {
      return this.langfuseService.executeTracedGeneration(generateOptions, options)
    }
    return generateText(generateOptions)
  }

  private async executeStreaming(streamOptions: Parameters<typeof streamText>[0], traceId?: string, options?: AiGenerateOptions) {
    if (traceId) {
      return this.langfuseService.executeTracedStreaming(streamOptions, options)
    }
    return streamText(streamOptions)
  }

  // ============================================================================
  // generateText() - Simple text generation
  // ============================================================================

  /**
   * Generates simple text completion using the Vercel AI SDK.
   *
   * @param input - The generation input configuration
   * @param input.prompt - The prompt string to generate text from
   * @param input.model - Optional model identifier. Falls back to the default configured model
   * @param input.options - Generation options (temperature, maxTokens, telemetry, etc.)
   * @param input.signal - Optional AbortSignal for request cancellation
   *
   * @returns {@link GenerateTextServiceResult} with the generated text and usage stats
   *
   * @example
   * const result = await aiService.generateText({
   *   prompt: 'Write a haiku about TypeScript',
   * })
   * console.log(result.result) // string
   */
  async generateText({
    prompt,
    model,
    options,
    signal,
  }: GenerateTextInput): Promise<GenerateTextServiceResult> {
    const abortController = signal ? undefined : new AbortController()
    const abortSignal = signal || abortController!.signal
    const modelInstance = await this.getModelInstance(model)
    const traceId = await this.buildTraceId(options)

    const generateOptions: Parameters<typeof generateText>[0] = {
      model: modelInstance,
      prompt,
      abortSignal,
      ...options,
      stopWhen: stepCountIs(options?.stopWhen ?? defaultStopWhen),
      experimental_telemetry: this.buildTelemetryOptions(options, traceId, 'ai.generateText'),
    }

    const result = await this.executeGeneration(generateOptions, traceId, options)

    return {
      result: result.text,
      usage: this.buildUsageStats(result.usage),
      finishReason: result.finishReason,
      abortController,
    }
  }

  // ============================================================================
  // generateObject<T>() - Structured output generation
  // ============================================================================

  /**
   * Generates structured output validated against a Zod schema.
   *
   * @template T - The expected output type inferred from the Zod schema
   *
   * @param input - The generation input configuration
   * @param input.prompt - The prompt string describing what to generate
   * @param input.schema - Zod schema for structured JSON output validation
   * @param input.model - Optional model identifier. Falls back to the default configured model
   * @param input.options - Generation options (temperature, maxTokens, telemetry, etc.)
   * @param input.signal - Optional AbortSignal for request cancellation
   *
   * @returns {@link GenerateObjectServiceResult} with the parsed and validated object
   *
   * @throws Error if schema validation fails
   *
   * @example
   * const userSchema = z.object({
   *   name: z.string(),
   *   age: z.number(),
   *   email: z.string().email(),
   * })
   *
   * const result = await aiService.generateObject({
   *   prompt: 'Generate a user profile for a software developer',
   *   schema: userSchema,
   * })
   * console.log(result.result) // { name: string, age: number, email: string }
   */
  async generateObject<T>({
    prompt,
    schema,
    model,
    options,
    signal,
  }: GenerateObjectInput<T>): Promise<GenerateObjectServiceResult<T>> {
    const abortController = signal ? undefined : new AbortController()
    const abortSignal = signal || abortController!.signal
    const modelInstance = await this.getModelInstance(model)
    const traceId = await this.buildTraceId(options)

    const schemaPrompt = this.createSchemaPrompt(schema)
    const fullPrompt = `${prompt}\n${schemaPrompt}`

    const generateOptions: Parameters<typeof generateText>[0] = {
      model: modelInstance,
      prompt: fullPrompt,
      abortSignal,
      ...options,
      stopWhen: stepCountIs(options?.stopWhen ?? defaultStopWhen),
      experimental_telemetry: this.buildTelemetryOptions(options, traceId, 'ai.generateObject'),
    }

    const result = await this.executeGeneration(generateOptions, traceId, options)

    let parsed: T
    try {
      parsed = this.validateAndParse(result.text, schema)
    }
    catch (error) {
      this.logger.error('Schema validation failed', error)
      throw new Error(`Schema validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return {
      result: parsed,
      usage: this.buildUsageStats(result.usage),
      finishReason: result.finishReason,
      abortController,
    }
  }

  // ============================================================================
  // chat() - Multi-turn conversation with tools
  // ============================================================================

  /**
   * Handles multi-turn conversations with optional tool support.
   *
   * @param input - The chat input configuration
   * @param input.messages - Conversation history as AiCoreMessage[]
   * @param input.tools - Optional tools (functions) the model can call during generation
   * @param input.model - Optional model identifier. Falls back to the default configured model
   * @param input.options - Generation options (temperature, maxTokens, telemetry, etc.)
   * @param input.signal - Optional AbortSignal for request cancellation
   *
   * @returns {@link ChatServiceResult} with the response text, updated messages, and tool call information
   *
   * @example
   * const result = await aiService.chat({
   *   messages: [
   *     { role: 'system', content: 'You are a helpful assistant.' },
   *     { role: 'user', content: 'What is TypeScript?' },
   *   ],
   * })
   * console.log(result.result) // Assistant's response
   * console.log(result.messages) // Updated conversation history
   *
   * @example
   * // With tools
   * const result = await aiService.chat({
   *   messages: [{ role: 'user', content: 'What is the weather in Paris?' }],
   *   tools: { weather: weatherTool },
   * })
   * console.log(result.toolCalls) // Tool calls made by the model
   */
  async chat({
    messages,
    tools,
    model,
    options,
    signal,
  }: ChatInput): Promise<ChatServiceResult> {
    const abortController = signal ? undefined : new AbortController()
    const abortSignal = signal || abortController!.signal
    const modelInstance = await this.getModelInstance(model)
    const traceId = await this.buildTraceId(options)

    const generateOptions: Parameters<typeof generateText>[0] = {
      model: modelInstance,
      messages: messages as ModelMessage[],
      abortSignal,
      ...options,
      tools,
      stopWhen: stepCountIs(options?.stopWhen ?? defaultStopWhen),
      experimental_telemetry: this.buildTelemetryOptions(options, traceId, 'ai.chat'),
    }

    const result = await this.executeGeneration(generateOptions, traceId, options)

    const updatedMessages: AiCoreMessage[] = [
      ...messages,
      { role: 'assistant', content: result.text },
    ]

    return {
      result: result.text,
      messages: updatedMessages,
      usage: this.buildUsageStats(result.usage),
      finishReason: result.finishReason,
      toolCalls: this.extractToolCalls(result.steps),
      toolResults: this.extractToolResults(result.steps),
      abortController,
    }
  }

  // ============================================================================
  // streamTextGenerator() - Streaming text generation
  // ============================================================================

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

    const traceId = await this.buildTraceId(options)

    const streamOptionsBase: Omit<Parameters<typeof streamText>[0], 'messages' | 'prompt'> = {
      model: modelInstance,
      abortSignal,
      ...options,
      tools,
      stopWhen: stepCountIs(options?.stopWhen ?? defaultStopWhen),
      experimental_telemetry: this.buildTelemetryOptions(options, traceId, 'ai.streamText'),
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
}
