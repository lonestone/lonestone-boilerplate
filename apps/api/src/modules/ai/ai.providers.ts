import type { LanguageModel } from 'ai'
import { createAnthropic as createAnthropicProvider } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI as createGoogleGenerativeAIProvider } from '@ai-sdk/google'
import { createMistral as createMistralProvider } from '@ai-sdk/mistral'
import { createOpenAI as createOpenAIProvider } from '@ai-sdk/openai'

export type ProviderInstance = (modelName: string) => LanguageModel

const googleProviderCache: Map<string, ProviderInstance> = new Map()
const anthropicProviderCache: Map<string, ProviderInstance> = new Map()

async function loadGoogleProvider(apiKey: string): Promise<ProviderInstance> {
  if (!googleProviderCache.has(apiKey)) {
    try {
      const provider = createGoogleGenerativeAIProvider({ apiKey })
      googleProviderCache.set(apiKey, provider)
    }
    catch (error) {
      if (error instanceof Error && (error.message.includes('Cannot find module') || error.message.includes('Failed to resolve'))) {
        throw new Error('Google provider requires @ai-sdk/google package. Please install it: pnpm add @ai-sdk/google')
      }
      throw error
    }
  }
  return googleProviderCache.get(apiKey)!
}

async function loadAnthropicProvider(apiKey: string): Promise<ProviderInstance> {
  if (!anthropicProviderCache.has(apiKey)) {
    try {
      const provider = createAnthropicProvider({ apiKey })
      anthropicProviderCache.set(apiKey, provider)
    }
    catch (error) {
      if (error instanceof Error && (error.message.includes('Cannot find module') || error.message.includes('Failed to resolve'))) {
        throw new Error('Anthropic provider requires @ai-sdk/anthropic package. Please install it: pnpm add @ai-sdk/anthropic')
      }
      throw error
    }
  }
  return anthropicProviderCache.get(apiKey)!
}

export function createOpenAI({ apiKey }: { apiKey?: string }): ProviderInstance {
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for OpenAI provider')
  }
  const provider = createOpenAIProvider({ apiKey })
  return (modelName: string) => provider(modelName)
}

export async function createGoogleGenerativeAI({ apiKey }: { apiKey?: string }): Promise<ProviderInstance> {
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY is required for Google provider')
  }
  return loadGoogleProvider(apiKey)
}

export async function createMistral({ apiKey }: { apiKey?: string }): Promise<ProviderInstance> {
  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY is required for Mistral provider')
  }
  return createMistralProvider({ apiKey })
}

export async function createAnthropic({ apiKey }: { apiKey?: string }): Promise<ProviderInstance> {
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required for Anthropic provider')
  }
  return loadAnthropicProvider(apiKey)
}
