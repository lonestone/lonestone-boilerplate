import type { Tool } from 'ai'
import type { ModelId } from '../ai.config'
import { registerSchema } from '@lonestone/nzoth/server'
import { z } from 'zod'
import { modelConfigBase } from '../ai.config'

export const aiGenerateOptionsSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
  topP: z.number().min(0).max(1).optional(),
  frequencyPenalty: z.number().min(-2).max(2).optional(),
  presencePenalty: z.number().min(-2).max(2).optional(),
  maxSteps: z.number().positive().optional(),
  stopWhen: z.number().positive().optional(),
  telemetry: z.object({
    traceName: z.string().describe('Merges LLM calls with the same traceName into the same trace.'),
    functionId: z.string().optional(),
    langfuseOriginalPrompt: z.string().optional().describe('The original prompt that was used to generate the response. (Use prompt.toJSON())'),
  }).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).meta({
  title: 'AiGenerateOptions',
  description: 'Options for an AI generation',
})

export type AiGenerateOptions = z.infer<typeof aiGenerateOptionsSchema>

export const coreMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.string(),
}).meta({
  title: 'CoreMessage',
  description: 'A message in the conversation history following Vercel AI SDK patterns',
})

export type CoreMessage = z.infer<typeof coreMessageSchema>

const aiGenerateInputBaseSchema = z.object({
  prompt: z.string().min(1).optional(),
  messages: z.array(coreMessageSchema).optional(),
  model: z.custom<ModelId>(val => typeof val === 'string').optional(),
  options: aiGenerateOptionsSchema.optional(),
  schema: z.custom<z.ZodType>(val => val && typeof val === 'object').optional(),
  tools: z.custom<Record<string, Tool>>(val => val && typeof val === 'object').optional(),
  signal: z.custom<AbortSignal>(val => val instanceof AbortSignal).optional(),
})

export const aiGenerateInputSchema = aiGenerateInputBaseSchema.refine(
  data => data.prompt || (data.messages && data.messages.length > 0),
  {
    message: 'Either prompt or messages must be provided',
    path: ['prompt', 'messages'],
  },
).meta({
  title: 'AiGenerateInput',
  description: 'Input for an AI generation. Either prompt (single turn) or messages (conversation history) must be provided.',
})

export type AiGenerateInputWithoutSchema = Omit<z.infer<typeof aiGenerateInputSchema>, 'schema'> & { schema?: undefined }
export type AiGenerateInputWithSchema<T> = Omit<z.infer<typeof aiGenerateInputSchema>, 'schema'> & { schema: z.ZodType<T> }
export type AiGenerateInput<T = string> = AiGenerateInputWithoutSchema | AiGenerateInputWithSchema<T>

const aiGenerateResultBaseSchema = z.object({
  error: z.string().optional(),
  usage: z
    .object({
      promptTokens: z.number(),
      completionTokens: z.number(),
      totalTokens: z.number(),
    })
    .optional(),
  finishReason: z.string().optional(),
  messages: z.array(coreMessageSchema).optional(),
  toolCalls: z
    .array(
      z.object({
        toolCallId: z.string(),
        toolName: z.string(),
        args: z.record(z.string(), z.unknown()),
      }),
    )
    .optional(),
  toolResults: z
    .array(
      z.object({
        toolCallId: z.string(),
        toolName: z.string(),
        result: z.unknown(),
      }),
    )
    .optional(),
})

export const aiGenerateOutputTextSchema = aiGenerateResultBaseSchema.extend({
  type: z.literal('text'),
  result: z.string(),
}).meta({
  title: 'AiGenerateOutputText',
  description: 'Text output from an AI generation',
})

export function makeAiGenerateOutputObjectSchema<T>(schema: z.ZodType<T>) {
  return aiGenerateResultBaseSchema.extend({
    type: z.literal('object'),
    result: schema,
  }).meta({
    title: 'AiGenerateOutputObject',
    description: 'Object output from an AI generation',
  })
}

export type AiGenerateOutputText = z.infer<typeof aiGenerateOutputTextSchema>
export type AiGenerateOutputObject<T> = z.infer<ReturnType<typeof makeAiGenerateOutputObjectSchema<T>>>
export type AiGenerateOutput<T = string> = AiGenerateOutputText | AiGenerateOutputObject<T>

export const chatSchemaTypeSchema = z.enum(['userProfile', 'task', 'product', 'none']).meta({
  title: 'ChatSchemaType',
  description: 'Predefined schema types for testing',
})

export type ChatSchemaType = z.infer<typeof chatSchemaTypeSchema>

export const chatRequestSchema = z.object({
  message: z.string().min(1).optional(),
  messages: z.array(coreMessageSchema).optional(),
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

export const streamRequestSchema = z.object({
  prompt: z.string().min(1).optional(),
  messages: z.array(coreMessageSchema).optional(),
  model: z.enum(Object.keys(modelConfigBase) as [ModelId]).optional(),
  options: aiGenerateOptionsSchema.optional(),
}).refine(
  data => data.prompt || (data.messages && data.messages.length > 0),
  {
    message: 'Either prompt or messages must be provided',
    path: ['prompt', 'messages'],
  },
).meta({
  title: 'StreamRequest',
  description: 'Request for streaming AI text generation. Either prompt (single turn) or messages (conversation history) must be provided.',
})

export type StreamRequest = z.infer<typeof streamRequestSchema>

export const aiStreamInputSchema = aiGenerateInputBaseSchema.omit({ schema: true }).refine(
  data => data.prompt || (data.messages && data.messages.length > 0),
  {
    message: 'Either prompt or messages must be provided',
    path: ['prompt', 'messages'],
  },
).meta({
  title: 'AiStreamInput',
  description: 'Input for streaming AI text generation. Either prompt (single turn) or messages (conversation history) must be provided. Schema is not supported for streaming.',
})

export type AiStreamInput = z.infer<typeof aiStreamInputSchema>

// SSE Event schemas for streaming
export const streamTextChunkEventSchema = z.object({
  type: z.literal('chunk'),
  text: z.string(),
}).meta({
  title: 'StreamTextChunkEvent',
  description: 'A text chunk event during streaming',
})

export type StreamTextChunkEvent = z.infer<typeof streamTextChunkEventSchema>

export const streamToolCallEventSchema = z.object({
  type: z.literal('tool-call'),
  toolCallId: z.string(),
  toolName: z.string(),
  args: z.record(z.string(), z.unknown()),
}).meta({
  title: 'StreamToolCallEvent',
  description: 'Event when a tool is being called during streaming',
})

export type StreamToolCallEvent = z.infer<typeof streamToolCallEventSchema>

export const streamToolResultEventSchema = z.object({
  type: z.literal('tool-result'),
  toolCallId: z.string(),
  toolName: z.string(),
  result: z.unknown(),
}).meta({
  title: 'StreamToolResultEvent',
  description: 'Event when a tool returns a result during streaming',
})

export type StreamToolResultEvent = z.infer<typeof streamToolResultEventSchema>

export const streamUsageSchema = z.object({
  promptTokens: z.number(),
  completionTokens: z.number(),
  totalTokens: z.number(),
}).meta({
  title: 'StreamUsage',
  description: 'Token usage information for the stream',
})

export type StreamUsage = z.infer<typeof streamUsageSchema>

export const streamDoneEventSchema = z.object({
  type: z.literal('done'),
  fullText: z.string(),
  usage: streamUsageSchema.optional(),
  finishReason: z.string().optional(),
}).meta({
  title: 'StreamDoneEvent',
  description: 'Final event when streaming is complete',
})

export type StreamDoneEvent = z.infer<typeof streamDoneEventSchema>

export const streamErrorEventSchema = z.object({
  type: z.literal('error'),
  message: z.string(),
}).meta({
  title: 'StreamErrorEvent',
  description: 'Error event during streaming',
})

export type StreamErrorEvent = z.infer<typeof streamErrorEventSchema>

export const streamEventSchema = z.discriminatedUnion('type', [
  streamTextChunkEventSchema,
  streamToolCallEventSchema,
  streamToolResultEventSchema,
  streamDoneEventSchema,
  streamErrorEventSchema,
]).meta({
  title: 'StreamEvent',
  description: 'SSE event for AI text streaming with tool support',
})

export type StreamEvent = z.infer<typeof streamEventSchema>

registerSchema(streamEventSchema)
