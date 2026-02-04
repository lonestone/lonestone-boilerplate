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
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { generateText, stepCountIs, streamText } from 'ai'
import { modelConfigBase, modelRegistry } from './ai.config'
import {
  createSchemaPromptCommand,
  createSchemaPromptCommandForChat,
  extractToolCalls,
  extractToolResults,
  getModelInstance,
  validateAndParse,
} from './ai.utils'
import { LangfuseService } from './langfuse.service'
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

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name)

  constructor(private readonly langfuseService: LangfuseService) {}

  onModuleInit() {
    this.registerDefaultModels()
  }

  private registerDefaultModels() {
    for (const [modelId, modelConfig] of Object.entries(modelConfigBase)) {
      modelRegistry.register(modelId as ModelId, modelConfig)
      this.logger.log(`Registered model: ${modelId}`)
    }
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

    const result = await this.executeGeneration(generateOptions, traceId, options)

    return {
      result: result.text,
      usage: buildUsageStats(result.usage),
      finishReason: result.finishReason,
      abortController,
    }
  }

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

    const result = await this.executeGeneration(generateOptions, traceId, options)

    let parsed: T
    try {
      parsed = validateAndParse(result.text, schema)
    }
    catch (error) {
      this.logger.error('Schema validation failed', error)
      throw new Error(`Schema validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return {
      result: parsed,
      usage: buildUsageStats(result.usage),
      finishReason: result.finishReason,
      abortController,
    }
  }

  /**
   * Handles multi-turn conversations with optional tool and schema support.
   *
   * When a schema is provided:
   * - A system message with schema instructions is appended to the messages
   * - The LLM response is validated against the schema (throws if invalid)
   * - The result is still returned as a string (JSON); parsing is the caller's responsibility
   * - The schema instruction message IS kept in the returned messages for traceability
   *
   * @param input - The chat input configuration
   * @param input.messages - Conversation history as AiCoreMessage[]
   * @param input.schema - Optional Zod schema for response validation
   * @param input.tools - Optional tools (functions) the model can call during generation
   * @param input.model - Optional model identifier. Falls back to the default configured model
   * @param input.options - Generation options (temperature, maxTokens, telemetry, etc.)
   * @param input.signal - Optional AbortSignal for request cancellation
   *
   * @returns {@link ChatServiceResult} with the response text, updated messages, and tool call information
   *
   * @throws Error if schema validation fails
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
   * // With schema validation
   * const userSchema = z.object({ name: z.string(), age: z.number() })
   * const result = await aiService.chat({
   *   messages: [{ role: 'user', content: 'Generate a user profile' }],
   *   schema: userSchema,
   * })
   * // result.result is a JSON string, validated against userSchema
   * // result.messages includes the schema instruction for traceability
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
    schema,
    tools,
    model,
    options,
    signal,
  }: ChatInput): Promise<ChatServiceResult> {
    const abortController = signal ? undefined : new AbortController()
    const abortSignal = signal || abortController!.signal
    const modelInstance = await getModelInstance(model)
    const traceId = await buildTraceId(options)

    // If schema provided, append schema instruction as user message (system messages can only be at the start of the conversation)
    const messagesForLLM: AiCoreMessage[] = schema
      ? [...messages, { role: 'assistant' as const, content: createSchemaPromptCommandForChat(schema), metadata: { isConsideredSystemMessage: true } }]
      : [...messages]

    const generateOptions: Parameters<typeof generateText>[0] = {
      model: modelInstance,
      messages: messagesForLLM as ModelMessage[],
      abortSignal,
      ...options,
      tools,
      stopWhen: stepCountIs(options?.stopWhen ?? DEFAULT_STOPWHEN),
      experimental_telemetry: buildTelemetryOptions(options, traceId, 'ai.chat'),
    }

    const result = await this.executeGeneration(generateOptions, traceId, options)

    // Validate response if schema provided (throws on invalid)
    if (schema) {
      try {
        validateAndParse(result.text, schema)
      }
      catch (error) {
        this.logger.error('Schema validation failed in chat', error)
        throw new Error(`Schema validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Build updated messages (includes schema instruction for traceability)
    const updatedMessages: AiCoreMessage[] = [
      ...messagesForLLM,
      { role: 'assistant', content: result.text },
    ]

    return {
      result: result.text,
      messages: updatedMessages,
      usage: buildUsageStats(result.usage),
      finishReason: result.finishReason,
      toolCalls: extractToolCalls(result.steps),
      toolResults: extractToolResults(result.steps),
      abortController,
    }
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

    const modelInstance = await getModelInstance(model)

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
