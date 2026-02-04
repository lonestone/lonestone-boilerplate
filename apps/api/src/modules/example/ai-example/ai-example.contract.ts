import { z } from 'zod'
import { modelConfigBase, ModelId } from '../../ai/ai.config'
import {
  aiBaseResultSchema,
  aiCoreMessageMetadataSchema,
  aiCoreMessageSchema,
  aiGenerateOptionsSchema,
  toolCallSchema,
  toolResultSchema,
} from '../../ai/contracts/ai.contract'

export const chatSchemaTypeSchema = z.enum(['userProfile', 'task', 'product', 'recipe', 'none']).meta({
  title: 'ChatSchemaType',
  description: 'Predefined schema types for testing structured output',
})

// Extended message schema with application-specific metadata
export const chatMessageWithSchemaTypeSchema = aiCoreMessageSchema.extend({
  metadata: aiCoreMessageMetadataSchema.extend({
    schemaType: chatSchemaTypeSchema.optional(),
  }).optional(),
}).meta({
  title: 'ChatMessageWithSchemaType',
  description: 'A message with optional schemaType metadata for identifying structured output',
})

export type ChatMessageWithSchemaType = z.infer<typeof chatMessageWithSchemaTypeSchema>

export type ChatSchemaType = z.infer<typeof chatSchemaTypeSchema>

export const chatSchemas: Record<Exclude<ChatSchemaType, 'none'>, z.ZodType> = {
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
  recipe: z.object({
    name: z.string().describe('Name of the recipe'),
    description: z.string().describe('Brief description of the dish'),
    prepTime: z.string().describe('Preparation time (e.g., "15 minutes")'),
    cookTime: z.string().describe('Cooking time (e.g., "30 minutes")'),
    servings: z.number().describe('Number of servings'),
    difficulty: z.enum(['easy', 'medium', 'hard']).describe('Difficulty level'),
    ingredients: z.array(z.object({
      name: z.string().describe('Ingredient name'),
      quantity: z.string().describe('Quantity with unit (e.g., "2 cups", "100g")'),
    })).describe('List of ingredients'),
    instructions: z.array(z.string()).describe('Step-by-step cooking instructions'),
    tips: z.array(z.string()).optional().describe('Optional cooking tips'),
  }),
}

export const chatRequestSchema = z.object({
  message: z.string().min(1).optional(),
  messages: z.array(chatMessageWithSchemaTypeSchema).optional(),
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
  description: 'Request for AI chat. Either message (single turn) or messages (conversation history) must be provided. schemaType can be used to request structured output.',
})

export type ChatRequest = z.infer<typeof chatRequestSchema>

export const chatResponseSchema = aiBaseResultSchema.extend({
  result: z.unknown(),
  messages: z.array(chatMessageWithSchemaTypeSchema).optional(),
  toolCalls: z.array(toolCallSchema).optional(),
  toolResults: z.array(toolResultSchema).optional(),
}).meta({
  title: 'ChatResponse',
  description: 'Response from AI chat. Messages may include schemaType metadata for structured output.',
})

export type ChatResponse = z.infer<typeof chatResponseSchema>
