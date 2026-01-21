import { config } from '../../config/env.config'
import { createAnthropic, createGoogleGenerativeAI, createMistral, createOpenAI, ProviderInstance } from './ai.providers'

// Providers are initialized synchronously for OpenAI, but async for Google/Anthropic
// We'll initialize them lazily when needed
export const providers: {
  openai: ProviderInstance | null
  google: Promise<ProviderInstance> | null
  anthropic: Promise<ProviderInstance> | null
  mistral: Promise<ProviderInstance> | null
} = {
  openai: config.ai.providers.openai.apiKey ? createOpenAI({ apiKey: config.ai.providers.openai.apiKey }) : null,
  google: config.ai.providers.google.apiKey ? createGoogleGenerativeAI({ apiKey: config.ai.providers.google.apiKey }) : null,
  anthropic: config.ai.providers.anthropic.apiKey ? createAnthropic({ apiKey: config.ai.providers.anthropic.apiKey }) : null,
  mistral: config.ai.providers.mistral.apiKey ? createMistral({ apiKey: config.ai.providers.mistral.apiKey }) : null,
}

export type ProviderName = keyof typeof providers

export interface ModelConfig {
  modelString: string
  provider: ProviderName
  isDefault: boolean
}

export const modelConfigBase = {
  OPENAI_GPT_5_NANO: {
    modelString: 'gpt-5-nano-2025-08-07',
    provider: 'openai' as const satisfies ProviderName,
    isDefault: false,
  },
  GOOGLE_GEMINI_3_FLASH: {
    modelString: 'gemini-3-flash-preview',
    provider: 'google' as const satisfies ProviderName,
    isDefault: false,
  },
  CLAUDE_HAIKU_3_5: {
    modelString: 'claude-3-5-haiku-latest',
    provider: 'anthropic' as const satisfies ProviderName,
    isDefault: false,
  },
  MISTRAL_SMALL: {
    modelString: 'mistral-small-2506',
    provider: 'mistral' as const satisfies ProviderName,
    isDefault: false,
  },
} as const satisfies Record<string, ModelConfig>

export type ModelId = keyof typeof modelConfigBase

class ModelRegistry {
  private models = new Map<ModelId, ModelConfig>()
  private defaultModelId: ModelId | null = null

  register(modelId: ModelId, modelConfig: ModelConfig): void {
    this.models.set(modelId, modelConfig)
    if (modelConfig.isDefault) {
      this.defaultModelId = modelId
    }
  }

  get(modelId: ModelId): ModelConfig | undefined {
    return this.models.get(modelId)
  }

  getDefault(): ModelId | null {
    return this.defaultModelId
  }

  getAll(): ModelId[] {
    return Array.from(this.models.keys())
  }

  has(modelId: ModelId): boolean {
    return this.models.has(modelId)
  }
}

export const modelRegistry = new ModelRegistry()
