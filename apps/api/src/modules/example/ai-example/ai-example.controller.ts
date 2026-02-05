import type { Tool } from 'ai'
import type { AiStreamEvent } from '../../ai/contracts/ai.contract'
import type {
  ChatRequest,
  ChatResponse,
  GenerateObjectRequest,
  GenerateObjectResponse,
  GenerateTextRequest,
  GenerateTextResponse,
  StreamChatRequest,
  StreamObjectRequest,
  StreamTextRequest,
} from './ai-example.contract'
import { TypedBody, TypedController, TypedRoute } from '@lonestone/nzoth/server'
import { Logger, MessageEvent, Sse, UseGuards } from '@nestjs/common'
import { Observable } from 'rxjs'
import { AiService } from '../../ai/ai.service'
import { LangfuseService } from '../../ai/langfuse.service'
import { AuthGuard } from '../../auth/auth.guard'
import {
  chatRequestSchema,
  chatResponseSchema,
  chatSchemas,
  generateObjectRequestSchema,
  generateObjectResponseSchema,
  generateTextRequestSchema,
  generateTextResponseSchema,
  streamChatRequestSchema,
  streamObjectRequestSchema,
  streamTextRequestSchema,
} from './ai-example.contract'
import { getCryptoPriceTool } from './tools/coingecko.tools'

@UseGuards(AuthGuard)
@TypedController('ai')
export class AiExampleController {
  private readonly logger = new Logger(AiExampleController.name)
  constructor(private readonly aiService: AiService, private readonly langfuseService: LangfuseService) { }

  // ============================================================================
  // Synchronous Routes
  // ============================================================================

  /**
   * This endpoint uses the API `generateText` endpoint to generate a text. It returns a string, and does not accept a schema
   * @param body
   * @returns GenerateTextResponse
   */
  @TypedRoute.Post('generate-text', generateTextResponseSchema)
  async generateText(@TypedBody(generateTextRequestSchema) body: GenerateTextRequest): Promise<GenerateTextResponse> {
    const prompt = await this.langfuseService.getLangfusePrompt('Boilerplate tests')

    const result = await this.aiService.generateText({
      prompt: body.prompt,
      model: body.model,
      options: {
        ...body.options,
        telemetry: {
          langfuseTraceName: `generate-text-at-time-${Date.now()}`,
          functionId: 'generate-text',
          langfuseOriginalPrompt: prompt?.toJSON(),
        },
      },
    })

    return {
      result: result.result,
      usage: result.usage,
      finishReason: result.finishReason,
    }
  }

  /**
   * This endpoint uses the API `generateObject` endpoint to generate a structured output, and requires a schema via the schemaType query parameter
   * 🚀 Improvement: Note that you could also let the client send a JSON representation of the schema, then convert it to a zod schema to pass it to aiService.generateObject
   * This would allow a fully dynamic schema management, without the need for the SchemaType enum.
   * @param body
   * @returns GenerateObjectResponse
   */
  @TypedRoute.Post('generate-object', generateObjectResponseSchema)
  async generateObject(@TypedBody(generateObjectRequestSchema) body: GenerateObjectRequest): Promise<GenerateObjectResponse> {
    const schema = chatSchemas[body.schemaType]
    const prompt = await this.langfuseService.getLangfusePrompt('Boilerplate tests')

    const result = await this.aiService.generateObject({
      prompt: body.prompt,
      schema,
      model: body.model,
      options: {
        ...body.options,
        telemetry: {
          langfuseTraceName: `generate-object-at-time-${Date.now()}`,
          functionId: 'generate-object',
          langfuseOriginalPrompt: prompt?.toJSON(),
        },
      },
    })

    return {
      result: result.result,
      usage: result.usage,
      finishReason: result.finishReason,
    }
  }

  /**
   * This endpoint uses the API `chat` endpoint to handle multi-turn conversations with optional tool support.
   * The client is supposed to send the full conversation history, including system messages, user messages and assistant messages.
   * Note that the client can send a schemaType, which will be used to validate the generated messages against the corresponding schema. This schema only applies to the last assistant message.
   * ⚠️ Warning: if you strip some messages from the history, the LLM may misbehave.
   * 🚀 Improvement: History management is tricky, and sending the whole history back and forth is not always practical.
   * You may want to switch to a more efficient history management strategy, such as using a database to store the history (or a stateful approach with a server-side session).
   * @param body
   * @returns ChatResponse
   */
  @TypedRoute.Post('chat', chatResponseSchema)
  async chat(@TypedBody(chatRequestSchema) body: ChatRequest): Promise<ChatResponse> {
    const schema = body.schemaType && body.schemaType !== 'none' ? chatSchemas[body.schemaType] : undefined

    // 🔧 The chat API supports tools
    const tools = {
      getCryptoPrice: getCryptoPriceTool,
    }

    const prompt = await this.langfuseService.getLangfusePrompt('Boilerplate tests')

    // 💡 Here we create a new traceName for each call. This means you will see a new trace in Langfuse UI for each message send by the client
    // You may wish to generate a single trace name for a given "session" or "conversation", and re-use it for each new message. This would merge all the spans in a single trace, which may be more convenient.
    const traceName = `chat-at-time-${Date.now()}`

    // 💡 We don't customise the functionId, which will be used to name the "span" in Langfuse UI.
    // If you merge multiple messages in a single trace, you may wish to use a custom functionId for each (e.g. `chat-message-1`, `chat-message-2`, etc.)
    const functionId = 'chat'

    const result = await this.aiService.chat({
      messages: body.messages,
      schema,
      tools,
      model: body.model,
      options: {
        ...body.options,
        telemetry: {
          langfuseTraceName: traceName,
          functionId,
          langfuseOriginalPrompt: prompt?.toJSON(),
        },
      },
    })

    // 💡 The AI service does not add the schemaType to the messages metadata. This is to keep the Service agnostic (our use of a `schemaType` here is a single example of how you could use it)
    // As we want to keep track of the schemaType — because we use it on the frontend for custom display— we add it to the last assistant message metadata.
    const schemaTypeValue = body.schemaType && body.schemaType !== 'none' ? body.schemaType : undefined
    const messagesWithSchemaType = result.messages.map((msg, idx) => {
      if (idx === result.messages.length - 1 && msg.role === 'assistant' && schemaTypeValue) {
        return { ...msg, metadata: { ...msg.metadata, schemaType: schemaTypeValue } }
      }
      return msg
    })

    return {
      result: result.result,
      messages: messagesWithSchemaType,
      usage: result.usage,
      finishReason: result.finishReason,
      toolCalls: result.toolCalls,
      toolResults: result.toolResults,
    }
  }

  // ============================================================================
  // Streaming Routes
  // ============================================================================

  @TypedRoute.Post('stream-text')
  @Sse('stream-text')
  streamText(@TypedBody(streamTextRequestSchema) body: StreamTextRequest): Observable<MessageEvent> {
    return this.createStreamObservable(body, 'stream-text')
  }

  @TypedRoute.Post('stream-object')
  @Sse('stream-object')
  streamObject(@TypedBody(streamObjectRequestSchema) body: StreamObjectRequest): Observable<MessageEvent> {
    return this.createStreamObservable(body, 'stream-object')
  }

  @TypedRoute.Post('stream-chat')
  @Sse('stream-chat')
  streamChat(@TypedBody(streamChatRequestSchema) body: StreamChatRequest): Observable<MessageEvent> {
    return this.createStreamObservable(body, 'stream-chat')
  }

  private createStreamObservable(
    body: StreamTextRequest | StreamObjectRequest | StreamChatRequest,
    functionId: string,
  ): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      let abortController: AbortController | null = null

      const runStream = async () => {
        try {
          const tools = {
            getCryptoPrice: getCryptoPriceTool,
          }

          abortController = new AbortController()

          // Build stream input based on request type
          const streamInput = this.buildStreamInput(body, tools, functionId)

          for await (const event of this.aiService.streamTextGenerator(streamInput, abortController.signal)) {
            if (subscriber.closed) {
              break
            }
            subscriber.next(new MessageEvent('message', { data: JSON.stringify(event) }))
          }
          if (!subscriber.closed) {
            subscriber.complete()
          }
        }
        catch (error) {
          if (subscriber.closed) {
            return
          }
          this.logger.error('Stream error', error)
          const errorEvent: AiStreamEvent = {
            type: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
          }
          subscriber.next(new MessageEvent('message', { data: JSON.stringify(errorEvent) }))
          subscriber.complete()
        }
      }

      runStream()

      return () => {
        if (abortController) {
          abortController.abort()
        }
      }
    })
  }

  private buildStreamInput(
    body: StreamTextRequest | StreamObjectRequest | StreamChatRequest,
    tools: Record<string, Tool>,
    functionId: string,
  ) {
    const baseOptions = {
      model: body.model,
      tools,
      options: {
        ...body.options,
        telemetry: {
          langfuseTraceName: `${functionId}-at-time-${Date.now()}`,
          functionId,
        },
      },
    }

    // Stream chat has messages, others have prompt
    if ('messages' in body) {
      return { ...baseOptions, messages: body.messages }
    }

    return { ...baseOptions, prompt: body.prompt }
  }
}
