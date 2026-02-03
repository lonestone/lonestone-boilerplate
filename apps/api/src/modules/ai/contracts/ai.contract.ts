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

export const aiCoreMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.string(),
}).meta({
  title: 'AiCoreMessage',
  description: 'A message in the conversation history following Vercel AI SDK patterns',
})

export type AiCoreMessage = z.infer<typeof aiCoreMessageSchema>

registerSchema(aiCoreMessageSchema)

const aiGenerateInputBaseSchema = z.object({
  prompt: z.string().min(1).optional(),
  messages: z.array(aiCoreMessageSchema).optional(),
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

export const aiGenerateResultBaseSchema = z.object({
  error: z.string().optional(),
  usage: z
    .object({
      promptTokens: z.number(),
      completionTokens: z.number(),
      totalTokens: z.number(),
    })
    .optional(),
  finishReason: z.string().optional(),
  messages: z.array(aiCoreMessageSchema).optional(),
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
