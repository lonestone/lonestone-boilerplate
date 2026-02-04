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

  @TypedRoute.Post('chat', chatResponseSchema)
  async chat(@TypedBody(chatRequestSchema) body: ChatRequest): Promise<ChatResponse> {
    const schema = body.schemaType && body.schemaType !== 'none' ? chatSchemas[body.schemaType] : undefined

    const tools = {
      getCryptoPrice: getCryptoPriceTool,
    }

    const prompt = await this.langfuseService.getLangfusePrompt('Boilerplate tests')

    const result = await this.aiService.chat({
      messages: body.messages,
      schema,
      tools,
      model: body.model,
      options: {
        ...body.options,
        telemetry: {
          langfuseTraceName: `chat-at-time-${Date.now()}`,
          functionId: 'chat',
          langfuseOriginalPrompt: prompt?.toJSON(),
        },
      },
    })

    // Add schemaType to the last (assistant) message if schema was used
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
