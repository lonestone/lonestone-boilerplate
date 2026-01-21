import type { ChatRequest, ChatResponse, ChatSchemaType } from './contracts/ai.contract'
import { TypedBody, TypedController, TypedRoute } from '@lonestone/nzoth/server'
import { UseGuards } from '@nestjs/common'
import { z } from 'zod'
import { AuthGuard } from '../auth/auth.guard'
import { AiService } from './ai.service'
import { chatRequestSchema, chatResponseSchema } from './contracts/ai.contract'
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
  constructor(private readonly aiService: AiService) {}

  @TypedRoute.Post('chat', chatResponseSchema)
  async chat(@TypedBody(chatRequestSchema) body: ChatRequest): Promise<ChatResponse> {
    const schema = body.schemaType && body.schemaType !== 'none' ? testSchemas[body.schemaType] : undefined

    const coingeckoMCPClient = await createCoingeckoMCPClient()
    const mcpTools = await coingeckoMCPClient.tools()

    const tools = {
      ...mcpTools,
      getCryptoPrice: getCryptoPriceTool,
    }

    // Build generate input - prefer messages over message for conversation history
    const generateInput = body.messages && body.messages.length > 0
      ? {
          messages: body.messages,
          model: body.model,
          options: body.options,
          schema,
          tools,
        }
      : {
          prompt: body.message!,
          model: body.model,
          options: body.options,
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
}
