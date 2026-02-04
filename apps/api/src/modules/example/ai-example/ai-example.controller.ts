import type {
  AiStreamEvent,
  AiStreamRequest,
} from '../../ai/contracts/ai.contract'
import type { ChatRequest, ChatResponse, ChatSchemaType } from './ai-example.contract'
import { TypedBody, TypedController, TypedRoute } from '@lonestone/nzoth/server'
import { Logger, MessageEvent, Sse, UseGuards } from '@nestjs/common'
import { Observable } from 'rxjs'
import { z } from 'zod'
import { AiService } from '../../ai/ai.service'
import {
  aiStreamRequestSchema,
} from '../../ai/contracts/ai.contract'
import { LangfuseService } from '../../ai/langfuse.service'
import { AuthGuard } from '../../auth/auth.guard'
import { chatRequestSchema, chatResponseSchema } from './ai-example.contract'
import { createCoingeckoMCPClient, getCryptoPriceTool } from './tools/coingecko.tools'

const testSchemas: Record<Exclude<ChatSchemaType, 'none'>, z.ZodType> = {
  userProfile: z.object({
    name: z.string(),
    age: z.number(),
    email: z.email(),
    bio: z.string().optional(),
    skills: z.array(z.string()).optional(),
  }),
  task: z.object({
    title: z.string(),
    description: z.string(),
    priority: z.enum(['low', 'medium', 'high']),
    dueDate: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
  product: z.object({
    name: z.string(),
    price: z.number(),
    description: z.string(),
    category: z.string(),
    inStock: z.boolean(),
    features: z.array(z.string()).optional(),
  }),
}

@UseGuards(AuthGuard)
@TypedController('ai')
export class AiExampleController {
  private readonly logger = new Logger(AiExampleController.name)
  constructor(private readonly aiService: AiService, private readonly langfuseService: LangfuseService) { }

  @TypedRoute.Post('chat', chatResponseSchema)
  async chat(@TypedBody(chatRequestSchema) body: ChatRequest): Promise<ChatResponse> {
    const schema = body.schemaType && body.schemaType !== 'none' ? testSchemas[body.schemaType] : undefined

    const coingeckoMCPClient = await createCoingeckoMCPClient()
    const mcpTools = await coingeckoMCPClient.tools()

    const tools = {
      ...mcpTools,
      getCryptoPrice: getCryptoPriceTool,
    }

    const prompt = await this.langfuseService.getLangfusePrompt('Boilerplate tests')

    const telemetryOptions = {
      langfuseTraceName: `chat-at-time-${Date.now()}`,
      functionId: 'chat',
      langfuseOriginalPrompt: prompt?.toJSON(),
    }

    // Case 1: Structured output with schema (single message only)
    if (schema && body.message) {
      const result = await this.aiService.generateObject({
        prompt: body.message,
        schema,
        model: body.model,
        options: {
          ...body.options,
          telemetry: telemetryOptions,
        },
      })

      return {
        result: result.result,
        usage: result.usage,
        finishReason: result.finishReason,
      }
    }

    // Case 2: Multi-turn conversation (no schema support)
    if (body.messages && body.messages.length > 0) {
      const result = await this.aiService.chat({
        messages: body.messages,
        tools,
        model: body.model,
        options: {
          ...body.options,
          telemetry: telemetryOptions,
        },
      })

      return {
        result: result.result,
        messages: result.messages,
        usage: result.usage,
        finishReason: result.finishReason,
        toolCalls: result.toolCalls,
        toolResults: result.toolResults,
      }
    }

    // Case 3: Simple text generation (single message, no schema)
    const result = await this.aiService.generateText({
      prompt: body.message!,
      model: body.model,
      options: {
        ...body.options,
        telemetry: telemetryOptions,
      },
    })

    return {
      result: result.result,
      usage: result.usage,
      finishReason: result.finishReason,
    }
  }

  @TypedRoute.Post('stream')
  @Sse('stream')
  stream(@TypedBody(aiStreamRequestSchema) body: AiStreamRequest): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      let abortController: AbortController | null = null

      const runStream = async () => {
        try {
          // const coingeckoMCPClient = await createCoingeckoMCPClient()
          // const mcpTools = await coingeckoMCPClient.tools()

          const tools = {
            // ...mcpTools,
            getCryptoPrice: getCryptoPriceTool,
          }

          abortController = new AbortController()

          for await (const event of this.aiService.streamTextGenerator({
            ...body,
            tools,
            options: {
              ...body.options,
              telemetry: {
                langfuseTraceName: `stream-at-time-${Date.now()}`,
                functionId: 'stream',
              },
            },
          }, abortController.signal)) {
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
}
