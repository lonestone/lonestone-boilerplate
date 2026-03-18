import { registerSchema } from '@lonestone/nzoth/server'
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

registerSchema(chatSchemaTypeSchema)

// Extended message schema with application-specific metadata
export const chatMessageWithSchemaTypeSchema = aiCoreMessageSchema.extend({
  metadata: aiCoreMessageMetadataSchema.extend({
    schemaType: chatSchemaTypeSchema.optional(),
  }).optional(),
}).meta({
  title: 'ChatMessageWithSchemaType',
  description: 'A message with optional schemaType metadata for identifying structured output',
})

registerSchema(chatMessageWithSchemaTypeSchema)

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

registerSchema(taskSchema)
registerSchema(productSchema)
registerSchema(recipeSchema)
registerSchema(userProfileSchema)

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

// ============================================================================
// Example use-case endpoints (trace patterns)
// ============================================================================

/** Use case 1: Single REST call, one generation. Request. */
export const useCase1SingleGenerationRequestSchema = generateTextRequestSchema.meta({
  title: 'UseCase1SingleGenerationRequest',
  description: 'Single generation; trace is finalized with name/output so Langfuse shows them',
})
export type UseCase1SingleGenerationRequest = z.infer<typeof useCase1SingleGenerationRequestSchema>

/** Use case 2: One REST call, several LLM calls in one trace. Request. */
export const useCase2GroupedCallsRequestSchema = z.object({
  prompts: z.array(z.string().min(1)).min(1).max(5).describe('Prompts for each step (same trace)'),
  model: z.enum(Object.keys(modelConfigBase) as [ModelId]).optional(),
}).meta({
  title: 'UseCase2GroupedCallsRequest',
  description: 'Multiple LLM calls in one request; one trace in Langfuse, finalized at end',
})
export type UseCase2GroupedCallsRequest = z.infer<typeof useCase2GroupedCallsRequestSchema>

export const useCase2GroupedCallsResponseSchema = z.object({
  traceName: z.string(),
  results: z.array(z.string()),
  usage: aiBaseResultSchema.shape.usage.optional(),
}).meta({
  title: 'UseCase2GroupedCallsResponse',
  description: 'Combined results from grouped LLM calls',
})
export type UseCase2GroupedCallsResponse = z.infer<typeof useCase2GroupedCallsResponseSchema>

/** Use case 3: One REST call, logical units (each unit = one trace). Request. */
export const useCase3LogicalUnitsRequestSchema = z.object({
  workflowPrompts: z.array(z.string().min(1)).min(1).max(5).describe('One prompt per logical workflow; each gets its own trace'),
  model: z.enum(Object.keys(modelConfigBase) as [ModelId]).optional(),
}).meta({
  title: 'UseCase3LogicalUnitsRequest',
  description: 'Multiple workflows; each workflow gets its own Langfuse trace (split per unit)',
})
export type UseCase3LogicalUnitsRequest = z.infer<typeof useCase3LogicalUnitsRequestSchema>

export const useCase3LogicalUnitsResponseSchema = z.object({
  workflows: z.array(z.object({
    index: z.number(),
    result: z.string(),
    usage: aiBaseResultSchema.shape.usage.optional(),
  })),
}).meta({
  title: 'UseCase3LogicalUnitsResponse',
  description: 'One result per workflow (each in its own trace)',
})
export type UseCase3LogicalUnitsResponse = z.infer<typeof useCase3LogicalUnitsResponseSchema>

/** Use case 4: Simple generation with sessionId — group traces in Langfuse by session (e.g. conversation). */
export const useCase4ChatSessionRequestSchema = z.object({
  prompt: z.string().min(1),
  sessionId: z.string().min(1).describe('Session ID to group traces in Langfuse (e.g. conversation or thread)'),
  model: z.enum(Object.keys(modelConfigBase) as [ModelId]).optional(),
}).meta({
  title: 'UseCase4ChatSessionRequest',
  description: 'Simple generateText with sessionId for grouping traces across requests',
})
export type UseCase4ChatSessionRequest = z.infer<typeof useCase4ChatSessionRequestSchema>
