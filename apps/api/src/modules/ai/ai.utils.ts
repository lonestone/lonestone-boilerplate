import type { generateText, LanguageModel } from 'ai'
import type { z } from 'zod'
import type { ModelId } from './ai.config'
import type { ToolCall, ToolResult } from './contracts/ai.contract'
import { Logger } from '@nestjs/common'
import { wrapWithRetryAfter } from './ai-rate-limit.middleware'
import { modelRegistry, providers } from './ai.config'

const logger = new Logger('AiUtils')

export async function getModel(modelId: ModelId): Promise<LanguageModel> {
  const modelConfig = modelRegistry.get(modelId)
  if (!modelConfig) {
    const availableModels = modelRegistry.getAll().join(', ')
    throw new Error(`Model "${modelId}" is not registered. Available models: ${availableModels}`)
  }

  const provider = providers[modelConfig.provider]
  if (!provider) {
    throw new Error(`Provider "${modelConfig.provider}" is not available. Please configure the API key for ${modelConfig.provider}.`)
  }

  const providerInstance = provider instanceof Promise ? await provider : provider
  const baseModel = providerInstance(modelConfig.modelString)

  return wrapWithRetryAfter(baseModel, undefined, logger)
}

export async function getDefaultModel(): Promise<LanguageModel | null> {
  const defaultModelId = modelRegistry.getDefault()
  if (!defaultModelId) {
    return null
  }
  return getModel(defaultModelId)
}

export async function getModelInstance(modelId?: ModelId): Promise<LanguageModel> {
  if (modelId) {
    return getModel(modelId)
  }
  const defaultModel = await getDefaultModel()
  if (!defaultModel) {
    throw new Error('No default model configured. Please specify a model or configure a default model.')
  }
  return defaultModel
}

export function sanitizeAiJson(aiOutput: string) {
  // 1️⃣ Trim and extract JSON object or array boundaries
  let jsonStr = aiOutput.trim()
  const firstBracket = jsonStr.indexOf('[')
  const firstBrace = jsonStr.indexOf('{')
  const isArray
    = (firstBracket !== -1 && firstBrace === -1)
      || (firstBracket !== -1 && firstBracket < firstBrace)
  if (isArray) {
    const lastBracket = jsonStr.lastIndexOf(']')
    if (lastBracket === -1) {
      throw new Error('No JSON object found in AI output')
    }
    jsonStr = jsonStr.slice(firstBracket, lastBracket + 1)
  }
  else {
    if (firstBrace === -1) {
      throw new Error('No JSON object found in AI output')
    }
    const lastBrace = jsonStr.lastIndexOf('}')
    if (lastBrace === -1) {
      throw new Error('No JSON object found in AI output')
    }
    jsonStr = jsonStr.slice(firstBrace, lastBrace + 1)
  }

  // 2️⃣ Normalize newlines and tabs globally
  jsonStr = jsonStr
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, '  ')

  // 3️⃣ Clean up weird control characters
  // eslint-disable-next-line no-control-regex
  jsonStr = jsonStr.replace(/[\x00-\x09\v\f\x0E-\x1F]/g, '')

  // 3️⃣½ Fix missing commas between string values and next keys
  jsonStr = jsonStr.replace(
    /(")\s*(?="[\w$]+"\s*:)/g,
    '$1, ',
  )

  // 4️⃣ Fix unescaped quotes inside strings
  //    e.g. "text": "Le client a dit "OK"" → "text": "Le client a dit \"OK\""
  jsonStr = jsonStr.replace(
    /:\s*"([\s\S]*?)"(?=,|\s*\}|$)/g,
    (match, value) => {
      const fixed = value
        .replace(/\\n/g, '\n')
        .replace(/(?<!\\)"/g, '\\"')
        .replace(/\n/g, '\\n')

      return `: "${fixed}"`
    },
  )

  // 5️⃣ Remove trailing commas in objects or arrays
  jsonStr = jsonStr.replace(/,\s*(\}|\])/g, '$1')

  // 6️⃣ Remove misplaced colons (like after commas or before objects)
  jsonStr = jsonStr.replace(/,\s*:/g, ',').replace(/:\s*:/g, ':')

  // 7️⃣ Attempt parsing safely
  return JSON.parse(jsonStr)
}

export function validateAndParse<T>(text: string, schema: z.ZodType<T>): T {
  const parsed = sanitizeAiJson(text)
  return schema.parse(parsed)
}

export function extractToolCalls(steps: Awaited<ReturnType<typeof generateText>>['steps'] | undefined): ToolCall[] | undefined {
  const toolCalls = steps?.flatMap(step =>
    (step.toolCalls || []).map(tc => ({
      toolCallId: tc.toolCallId,
      toolName: tc.toolName,
      args: tc.input as Record<string, unknown>,
    })),
  )
  return toolCalls && toolCalls.length > 0 ? toolCalls : undefined
}

export function extractToolResults(steps: Awaited<ReturnType<typeof generateText>>['steps'] | undefined): ToolResult[] | undefined {
  const toolResults = steps?.flatMap(step =>
    (step.toolResults || []).map(tr => ({
      toolCallId: tr.toolCallId,
      toolName: tr.toolName,
      result: tr.output,
    })),
  )
  return toolResults && toolResults.length > 0 ? toolResults : undefined
}

export function createSchemaPromptCommand(schema: z.ZodType): string {
  return `
  
  IMPORTANT: I must respond with valid JSON that matches the expected schema structure.
  If I need additional information to fulfill the user's request, I will use the available tools first. Then, I will return my response as valid JSON only, with no additional text, markdown formatting, or explanation before or after the JSON. Return only the JSON object or array.
  
  The schema is:
  ${JSON.stringify(schema.toJSONSchema(), null, 2)}
  `
}

export function createSchemaPromptCommandForChat(schema: z.ZodType): string {
  return `
  IMPORTANT: I must respond to the next user message with valid JSON that matches the expected schema structure. If I need additional information to fulfill the user's request, I will use the available tools first.
  My response must be valid JSON only, with no additional text, markdown formatting, or explanation before or after the JSON. I will return only the JSON object or array.
  I will respect this rule only once. Afterward, I will go back to my normal behavior except if asked by the user or provided with a new schema.
  
  The schema is:
  ${JSON.stringify(schema.toJSONSchema(), null, 2)}
  `
}
