import type { ModelId } from '../ai.config'
import { Tool } from 'ai'
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
}).meta({
  title: 'AiGenerateOptions',
  description: 'Options for an AI generation',
})

export type AiGenerateOptions = z.infer<typeof aiGenerateOptionsSchema>

export const aiGenerateInputSchema = z.object({
  prompt: z.string().min(1),
  model: z.custom<ModelId>(val => typeof val === 'string').optional(),
  options: aiGenerateOptionsSchema.optional(),
  schema: z.custom<z.ZodType>(val => val && typeof val === 'object').optional(),
  tools: z.custom<Record<string, Tool>>(val => val && typeof val === 'object').optional(),
  signal: z.custom<AbortSignal>(val => val instanceof AbortSignal).optional(),
}).meta({
  title: 'AiGenerateInput',
  description: 'Input for an AI generation',
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
  message: z.string().min(1),
  model: z.enum(Object.keys(modelConfigBase) as [ModelId]).optional(),
  options: aiGenerateOptionsSchema.optional(),
  schemaType: chatSchemaTypeSchema.optional(),
}).meta({
  title: 'ChatRequest',
  description: 'Request for AI chat',
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
