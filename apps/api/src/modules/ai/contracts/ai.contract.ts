import type { Tool } from 'ai'
import type { ModelId } from '../ai.config'
import { registerSchema } from '@lonestone/nzoth/server'
import { z } from 'zod'
import { modelConfigBase } from '../ai.config'

// ============================================================================
// Shared Schemas
// ============================================================================

export const aiGenerateOptionsSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
  topP: z.number().min(0).max(1).optional(),
  frequencyPenalty: z.number().min(-2).max(2).optional(),
  presencePenalty: z.number().min(-2).max(2).optional(),
  maxSteps: z.number().positive().optional(),
  stopWhen: z.number().positive().optional(),
  telemetry: z.object({
    langfuseTraceName: z.string().describe('This enables Langfuse telemetry. Several LLM call can use the same traceName and will be merged into the same trace in Langfuse UI.'),
    langfuseOriginalPrompt: z.string().optional().describe('The original prompt that was used to generate the response. (Use prompt.toJSON())'),
    functionId: z.string().optional().describe('This is the function ID that will be used to identify the LLM call in Langfuse UI. The Langfuse Span will be named after this function ID.'),
  }).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).meta({
  title: 'AiGenerateOptions',
  description: 'Options for an AI generation',
})

export type AiGenerateOptions = z.infer<typeof aiGenerateOptionsSchema>

export const aiCoreMessageMetadataSchema = z.object({
  isConsideredSystemMessage: z.boolean().optional(),
})

export const aiCoreMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.string(),
  metadata: aiCoreMessageMetadataSchema.optional(),
}).meta({
  title: 'AiCoreMessage',
  description: 'A message in the conversation history following Vercel AI SDK patterns',
})

export type AiCoreMessage = z.infer<typeof aiCoreMessageSchema>

registerSchema(aiCoreMessageSchema)

// ============================================================================
// Base Schemas (shared fields)
// ============================================================================

export const aiBaseInputSchema = z.object({
  model: z.custom<ModelId>(val => typeof val === 'string').optional(),
  options: aiGenerateOptionsSchema.optional(),
  signal: z.custom<AbortSignal>(val => val instanceof AbortSignal).optional(),
})

export const tokenUsageSchema = z.object({
  promptTokens: z.number(),
  completionTokens: z.number(),
  totalTokens: z.number(),
}).meta({
  title: 'TokenUsage',
  description: 'Token usage information for an AI generation',
})

export type TokenUsage = z.infer<typeof tokenUsageSchema>

export const aiBaseResultSchema = z.object({
  usage: tokenUsageSchema.optional(),
  finishReason: z.string().optional(),
})

export const toolCallSchema = z.object({
  toolCallId: z.string(),
  toolName: z.string(),
  args: z.record(z.string(), z.unknown()),
}).meta({
  title: 'ToolCall',
  description: 'A tool call made by the AI',
})

export type ToolCall = z.infer<typeof toolCallSchema>

export const toolResultSchema = z.object({
  toolCallId: z.string(),
  toolName: z.string(),
  result: z.unknown(),
}).meta({
  title: 'ToolResult',
  description: 'The result of a tool call',
})

export type ToolResult = z.infer<typeof toolResultSchema>

// ============================================================================
// generateText() - Simple text generation
// ============================================================================

export const generateTextInputSchema = aiBaseInputSchema.extend({
  prompt: z.string().min(1),
}).meta({
  title: 'GenerateTextInput',
  description: 'Input for simple text generation',
})

export type GenerateTextInput = z.infer<typeof generateTextInputSchema>

export const generateTextResultSchema = aiBaseResultSchema.extend({
  result: z.string(),
}).meta({
  title: 'GenerateTextResult',
  description: 'Result of simple text generation',
})

export type GenerateTextResult = z.infer<typeof generateTextResultSchema>

// ============================================================================
// generateObject<T>() - Structured output generation
// ============================================================================

export const generateObjectInputSchema = aiBaseInputSchema.extend({
  prompt: z.string().min(1),
  schema: z.custom<z.ZodType>(val => val && typeof val === 'object'),
}).meta({
  title: 'GenerateObjectInput',
  description: 'Input for structured object generation with schema validation',
})

export type GenerateObjectInput<T> = Omit<z.infer<typeof generateObjectInputSchema>, 'schema'> & {
  schema: z.ZodType<T>
}

export function makeGenerateObjectResultSchema<T>(schema: z.ZodType<T>) {
  return aiBaseResultSchema.extend({
    result: schema,
  }).meta({
    title: 'GenerateObjectResult',
    description: 'Result of structured object generation',
  })
}

export type GenerateObjectResult<T> = z.infer<ReturnType<typeof makeGenerateObjectResultSchema<T>>>

// ============================================================================
// chat() - Multi-turn conversation with tools and optional schema validation
// ============================================================================

export const chatInputSchema = aiBaseInputSchema.extend({
  messages: z.array(aiCoreMessageSchema).min(1),
  schema: z.custom<z.ZodType>(val => val && typeof val === 'object').optional(),
  tools: z.custom<Record<string, Tool>>(val => val && typeof val === 'object').optional(),
}).meta({
  title: 'ChatInput',
  description: 'Input for multi-turn conversation with optional tools and schema validation',
})

export type ChatInput = z.infer<typeof chatInputSchema>

export const chatResultSchema = aiBaseResultSchema.extend({
  result: z.string(),
  messages: z.array(aiCoreMessageSchema),
  toolCalls: z.array(toolCallSchema).optional(),
  toolResults: z.array(toolResultSchema).optional(),
}).meta({
  title: 'ChatResult',
  description: 'Result of a chat conversation',
})

export type ChatResult = z.infer<typeof chatResultSchema>

// ============================================================================
// Streaming Schemas
// ============================================================================

export const aiStreamRequestSchema = z.object({
  prompt: z.string().min(1).optional(),
  messages: z.array(aiCoreMessageSchema).optional(),
  model: z.enum(Object.keys(modelConfigBase) as [ModelId]).optional(),
  options: aiGenerateOptionsSchema.optional(),
}).refine(
  data => data.prompt || (data.messages && data.messages.length > 0),
  {
    message: 'Either prompt or messages must be provided',
    path: ['prompt', 'messages'],
  },
).meta({
  title: 'AiStreamRequest',
  description: 'Request for streaming AI text generation. Either prompt (single turn) or messages (conversation history) must be provided.',
})

export type AiStreamRequest = z.infer<typeof aiStreamRequestSchema>

export const aiStreamTextChunkEventSchema = z.object({
  type: z.literal('chunk'),
  text: z.string(),
}).meta({
  title: 'AiStreamTextChunkEvent',
  description: 'A text chunk event during streaming',
})

export type AiStreamTextChunkEvent = z.infer<typeof aiStreamTextChunkEventSchema>

export const aiStreamToolCallEventSchema = z.object({
  type: z.literal('tool-call'),
  toolCallId: z.string(),
  toolName: z.string(),
  args: z.record(z.string(), z.unknown()),
}).meta({
  title: 'AiStreamToolCallEvent',
  description: 'Event when a tool is being called during streaming',
})

export type AiStreamToolCallEvent = z.infer<typeof aiStreamToolCallEventSchema>

export const aiStreamToolResultEventSchema = z.object({
  type: z.literal('tool-result'),
  toolCallId: z.string(),
  toolName: z.string(),
  result: z.unknown(),
}).meta({
  title: 'AiStreamToolResultEvent',
  description: 'Event when a tool returns a result during streaming',
})

export type AiStreamToolResultEvent = z.infer<typeof aiStreamToolResultEventSchema>

export const aiStreamUsageSchema = z.object({
  promptTokens: z.number(),
  completionTokens: z.number(),
  totalTokens: z.number(),
}).meta({
  title: 'AiStreamUsage',
  description: 'Token usage information for the stream',
})

export type AiStreamUsage = z.infer<typeof aiStreamUsageSchema>

export const aiStreamDoneEventSchema = z.object({
  type: z.literal('done'),
  fullText: z.string(),
  usage: aiStreamUsageSchema.optional(),
  finishReason: z.string().optional(),
}).meta({
  title: 'AiStreamDoneEvent',
  description: 'Final event when streaming is complete',
})

export type AiStreamDoneEvent = z.infer<typeof aiStreamDoneEventSchema>

export const aiStreamErrorEventSchema = z.object({
  type: z.literal('error'),
  message: z.string(),
}).meta({
  title: 'AiStreamErrorEvent',
  description: 'Error event during streaming',
})

export type AiStreamErrorEvent = z.infer<typeof aiStreamErrorEventSchema>

export const aiStreamEventSchema = z.discriminatedUnion('type', [
  aiStreamTextChunkEventSchema,
  aiStreamToolCallEventSchema,
  aiStreamToolResultEventSchema,
  aiStreamDoneEventSchema,
  aiStreamErrorEventSchema,
]).meta({
  title: 'AiStreamEvent',
  description: 'SSE event for AI text streaming with tool support',
})

export type AiStreamEvent = z.infer<typeof aiStreamEventSchema>

registerSchema(aiStreamEventSchema)
