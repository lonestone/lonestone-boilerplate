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

export const userProfileSchema = z.object({
  name: z.string(),
  age: z.number(),
  email: z.email(),
  bio: z.string().optional(),
  skills: z.array(z.string()).optional(),
}).meta({
  title: 'UserProfile',
  description: 'A user profile',
})

export const taskSchema = z.object({
  title: z.string(),
  description: z.string(),
  priority: z.enum(['low', 'medium', 'high']),
  dueDate: z.string().optional(),
  tags: z.array(z.string()).optional(),
}).meta({
  title: 'Task',
  description: 'A task',
})

export const productSchema = z.object({
  name: z.string(),
  price: z.number(),
  description: z.string(),
  category: z.string(),
  inStock: z.boolean(),
  features: z.array(z.string()).optional(),
}).meta({
  title: 'Product',
  description: 'A product',
})

export const recipeSchema = z.object({
  name: z.string(),
  description: z.string(),
  prepTime: z.string(),
  cookTime: z.string(),
  servings: z.number(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  ingredients: z.array(z.object({
    name: z.string(),
    quantity: z.string(),
  })),
  instructions: z.array(z.string()),
  tips: z.array(z.string()).optional(),
}).meta({
  title: 'Recipe',
  description: 'A recipe',
})

export const chatSchemas: Record<Exclude<ChatSchemaType, 'none'>, z.ZodType> = {
  userProfile: userProfileSchema,
  task: taskSchema,
  product: productSchema,
  recipe: recipeSchema,
}

// ============================================================================
// Generate Text - Single prompt text generation
// ============================================================================

export const generateTextRequestSchema = z.object({
  prompt: z.string().min(1),
  model: z.enum(Object.keys(modelConfigBase) as [ModelId]).optional(),
  options: aiGenerateOptionsSchema.optional(),
}).meta({
  title: 'GenerateTextRequest',
  description: 'Request for simple text generation with a single prompt',
})

export type GenerateTextRequest = z.infer<typeof generateTextRequestSchema>

export const generateTextResponseSchema = aiBaseResultSchema.extend({
  result: z.string(),
}).meta({
  title: 'GenerateTextResponse',
  description: 'Response from text generation',
})

export type GenerateTextResponse = z.infer<typeof generateTextResponseSchema>

// ============================================================================
// Generate Object - Structured output generation
// ============================================================================

export const generateObjectRequestSchema = z.object({
  prompt: z.string().min(1),
  schemaType: z.enum(['userProfile', 'task', 'product', 'recipe']),
  model: z.enum(Object.keys(modelConfigBase) as [ModelId]).optional(),
  options: aiGenerateOptionsSchema.optional(),
}).meta({
  title: 'GenerateObjectRequest',
  description: 'Request for structured object generation with a predefined schema type',
})

export type GenerateObjectRequest = z.infer<typeof generateObjectRequestSchema>

export const generateObjectResponseSchema = aiBaseResultSchema.extend({
  result: z.unknown(),
}).meta({
  title: 'GenerateObjectResponse',
  description: 'Response from structured object generation',
})

export type GenerateObjectResponse = z.infer<typeof generateObjectResponseSchema>

// ============================================================================
// Chat - Multi-turn conversation
// ============================================================================

export const chatRequestSchema = z.object({
  messages: z.array(chatMessageWithSchemaTypeSchema).min(1),
  model: z.enum(Object.keys(modelConfigBase) as [ModelId]).optional(),
  options: aiGenerateOptionsSchema.optional(),
  schemaType: chatSchemaTypeSchema.optional(),
}).meta({
  title: 'ChatRequest',
  description: 'Request for multi-turn AI conversation with message history. schemaType can be used to request structured output.',
})

export type ChatRequest = z.infer<typeof chatRequestSchema>

export const chatResponseSchema = aiBaseResultSchema.extend({
  result: z.string(),
  messages: z.array(chatMessageWithSchemaTypeSchema),
  toolCalls: z.array(toolCallSchema).optional(),
  toolResults: z.array(toolResultSchema).optional(),
}).meta({
  title: 'ChatResponse',
  description: 'Response from AI chat conversation',
})

export type ChatResponse = z.infer<typeof chatResponseSchema>

// ============================================================================
// Stream Text - Streaming text generation
// ============================================================================

export const streamTextRequestSchema = z.object({
  prompt: z.string().min(1),
  model: z.enum(Object.keys(modelConfigBase) as [ModelId]).optional(),
  options: aiGenerateOptionsSchema.optional(),
}).meta({
  title: 'StreamTextRequest',
  description: 'Request for streaming text generation with a single prompt',
})

export type StreamTextRequest = z.infer<typeof streamTextRequestSchema>

// ============================================================================
// Stream Object - Streaming structured output generation
// ============================================================================

export const streamObjectRequestSchema = z.object({
  prompt: z.string().min(1),
  schemaType: z.enum(['userProfile', 'task', 'product', 'recipe']),
  model: z.enum(Object.keys(modelConfigBase) as [ModelId]).optional(),
  options: aiGenerateOptionsSchema.optional(),
}).meta({
  title: 'StreamObjectRequest',
  description: 'Request for streaming structured object generation',
})

export type StreamObjectRequest = z.infer<typeof streamObjectRequestSchema>

// ============================================================================
// Stream Chat - Streaming multi-turn conversation
// ============================================================================

export const streamChatRequestSchema = z.object({
  messages: z.array(chatMessageWithSchemaTypeSchema).min(1),
  model: z.enum(Object.keys(modelConfigBase) as [ModelId]).optional(),
  options: aiGenerateOptionsSchema.optional(),
}).meta({
  title: 'StreamChatRequest',
  description: 'Request for streaming multi-turn AI conversation',
})

export type StreamChatRequest = z.infer<typeof streamChatRequestSchema>
