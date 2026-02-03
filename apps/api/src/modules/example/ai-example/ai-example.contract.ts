import { z } from 'zod'
import { modelConfigBase, ModelId } from '../../ai/ai.config'
import {
  aiCoreMessageSchema,
  aiGenerateOptionsSchema,
  aiGenerateOutputTextSchema,
  aiGenerateResultBaseSchema,
} from '../../ai/contracts/ai.contract'

export const chatSchemaTypeSchema = z.enum(['userProfile', 'task', 'product', 'none']).meta({
  title: 'ChatSchemaType',
  description: 'Predefined schema types for testing',
})

export type ChatSchemaType = z.infer<typeof chatSchemaTypeSchema>

export const chatRequestSchema = z.object({
  message: z.string().min(1).optional(),
  messages: z.array(aiCoreMessageSchema).optional(),
  conversationId: z.string().optional(),
  model: z.enum(Object.keys(modelConfigBase) as [ModelId]).optional(),
  options: aiGenerateOptionsSchema.optional(),
  schemaType: chatSchemaTypeSchema.optional(),
}).refine(
  data => data.message || (data.messages && data.messages.length > 0),
  {
    message: 'Either message or messages must be provided',
    path: ['message', 'messages'],
  },
).meta({
  title: 'ChatRequest',
  description: 'Request for AI chat. Either message (single turn) or messages (conversation history) must be provided.',
})

export type ChatRequest = z.infer<typeof chatRequestSchema>

export const chatResponseSchema = z.discriminatedUnion('type', [
  aiGenerateOutputTextSchema,
  aiGenerateResultBaseSchema.extend({
    type: z.literal('object'),
    result: z.unknown(),
  }),
]).meta({
  title: 'ChatResponse',
  description: 'Response from AI chat',
})

export type ChatResponse = z.infer<typeof chatResponseSchema>
