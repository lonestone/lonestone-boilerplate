import type { LanguageModel } from 'ai'
import type { ModelId } from './ai.config'
import { modelRegistry, providers } from './ai.config'

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

  return providerInstance(modelConfig.modelString)
}

export async function getDefaultModel(): Promise<LanguageModel | null> {
  const defaultModelId = modelRegistry.getDefault()
  if (!defaultModelId) {
    return null
  }
  return getModel(defaultModelId)
}

export function sanitizeAiJson(aiOutput: string) {
  // 1️⃣ Trim and extract JSON object boundaries
  let jsonStr = aiOutput.trim()
  const firstBrace = jsonStr.indexOf('{')
  const lastBrace = jsonStr.lastIndexOf('}')
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error('No JSON object found in AI output')
  }
  jsonStr = jsonStr.slice(firstBrace, lastBrace + 1)

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
