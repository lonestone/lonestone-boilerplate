import type { ChatRequest, ChatResponse, ChatSchemaType, StreamEvent, StreamRequest } from './contracts/ai.contract'
import { TypedBody, TypedController, TypedRoute } from '@lonestone/nzoth/server'
import { Logger, MessageEvent, Sse, UseGuards } from '@nestjs/common'
import { Observable } from 'rxjs'
import { z } from 'zod'
import { AuthGuard } from '../auth/auth.guard'
import { AiService } from './ai.service'
import { chatRequestSchema, chatResponseSchema, streamRequestSchema } from './contracts/ai.contract'
import { LangfuseService } from './langfuse.service'
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
export class AiController {
  private readonly logger = new Logger(AiController.name)
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

    // Build generate input - prefer messages over message for conversation history
    const generateInput = body.messages && body.messages.length > 0
      ? {
          messages: body.messages,
          model: body.model,
          options: {
            ...body.options,
            telemetry: {
              traceName: `chat-at-time-${Date.now()}`,
              functionId: 'chat',
              originalPrompt: prompt?.toJSON(),
            },
          },
          schema,
          tools,
        }
      : {
          prompt: body.message!,
          model: body.model,
          options: {
            ...body.options,
            telemetry: {
              traceName: `chat-at-time-${Date.now()}`,
              functionId: 'chat',
              originalPrompt: prompt?.toJSON(),
            },
          },
          schema,
          tools,
        }

    if (schema) {
      const result = await this.aiService.generate({
        ...generateInput,
        schema,
      })

      return {
        result: result.result,
        error: result.error,
        type: result.type,
        usage: result.usage,
        finishReason: result.finishReason,
        messages: result.messages,
        toolCalls: result.toolCalls,
        toolResults: result.toolResults,
      }
    }
    else {
      const result = await this.aiService.generate(generateInput)

      return {
        result: result.result as string,
        error: result.error,
        type: result.type,
        usage: result.usage,
        finishReason: result.finishReason,
        messages: result.messages,
        toolCalls: result.toolCalls,
        toolResults: result.toolResults,
      }
    }
  }

  @TypedRoute.Post('stream')
  @Sse('stream')
  stream(@TypedBody(streamRequestSchema) body: StreamRequest): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      let abortController: AbortController | null = null

      const runStream = async () => {
        try {
          const coingeckoMCPClient = await createCoingeckoMCPClient()
          const mcpTools = await coingeckoMCPClient.tools()

          const tools = {
            ...mcpTools,
            getCryptoPrice: getCryptoPriceTool,
          }

          abortController = new AbortController()

          for await (const event of this.aiService.streamTextGenerator({
            ...body,
            tools,
            options: {
              ...body.options,
              telemetry: {
                traceName: `stream-at-time-${Date.now()}`,
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
          const errorEvent: StreamEvent = {
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
