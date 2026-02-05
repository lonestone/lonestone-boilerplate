import { ModelId, modelRegistry, providers } from '../ai.config'
import { getDefaultModel, getModel, sanitizeAiJson } from '../ai.utils'

// Mock dependencies
jest.mock('../ai.config', () => ({
  modelRegistry: {
    get: jest.fn(),
    getAll: jest.fn(),
    getDefault: jest.fn(),
  },
  providers: {
    openai: jest.fn(),
    google: null,
    anthropic: null,
    mistral: null,
  },
}))

describe('ai.utils', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getModel', () => {
    it('should return model instance for valid model ID', async () => {
      const mockModelConfig = {
        provider: 'openai',
        modelString: 'gpt-5-nano-2025-08-07',
      }

      const mockProvider = jest.fn().mockReturnValue({ provider: 'openai', modelId: 'gpt-5-nano-2025-08-07' })

      ;(modelRegistry.get as jest.Mock).mockReturnValue(mockModelConfig)
      ;(providers.openai as jest.Mock) = mockProvider

      expect(modelRegistry.get).toHaveBeenCalledWith('OPENAI_GPT_5_NANO')
      expect(mockProvider).toHaveBeenCalledWith('gpt-5-nano-2025-08-07')
    })

    it('should throw error when model is not registered', async () => {
      ;(modelRegistry.get as jest.Mock).mockReturnValue(undefined)
      ;(modelRegistry.getAll as jest.Mock).mockReturnValue(['OPENAI_GPT_5_NANO'])

      await expect(getModel('INVALID_MODEL' as unknown as ModelId)).rejects.toThrow(
        'Model "INVALID_MODEL" is not registered',
      )
    })

    it('should throw error when provider is not available', async () => {
      const mockModelConfig = {
        provider: 'google',
        modelString: 'gemini-3-flash-preview',
      }

      ;(modelRegistry.get as jest.Mock).mockReturnValue(mockModelConfig)
      ;(providers.google) = null

      await expect(getModel('GOOGLE_GEMINI_3_FLASH' as unknown as ModelId)).rejects.toThrow(
        'Provider "google" is not available',
      )
    })

    it('should handle async providers', async () => {
      const mockModelConfig = {
        provider: 'google',
        modelString: 'gemini-3-flash-preview',
      }

      const mockProvider = jest.fn().mockReturnValue({ provider: 'google', modelId: 'gemini-3-flash-preview' })
      const asyncProvider = Promise.resolve(mockProvider)

      ;(modelRegistry.get as jest.Mock).mockReturnValue(mockModelConfig)
      ;(providers.google) = asyncProvider

      await getModel('GOOGLE_GEMINI_3_FLASH' as unknown as ModelId)

      expect(mockProvider).toHaveBeenCalledWith('gemini-3-flash-preview')
    })
  })

  describe('getDefaultModel', () => {
    it('should return default model when configured', async () => {
      const mockModelConfig = {
        provider: 'openai',
        modelString: 'gpt-5-nano-2025-08-07',
      }

      const mockProvider = jest.fn().mockReturnValue({ provider: 'openai', modelId: 'gpt-5-nano-2025-08-07' })

      ;(modelRegistry.getDefault as jest.Mock).mockReturnValue('OPENAI_GPT_5_NANO')
      ;(modelRegistry.get as jest.Mock).mockReturnValue(mockModelConfig)
      ;(providers.openai) = mockProvider

      await getDefaultModel()

      expect(modelRegistry.getDefault).toHaveBeenCalled()
    })

    it('should return null when no default model is configured', async () => {
      ;(modelRegistry.getDefault as jest.Mock).mockReturnValue(null)

      const model = await getDefaultModel()

      expect(model).toBeNull()
    })
  })

  describe('sanitizeAiJson', () => {
    it('should parse valid JSON', () => {
      const validJson = '{"name": "John", "age": 30}'
      const result = sanitizeAiJson(validJson)
      expect(result).toEqual({ name: 'John', age: 30 })
    })

    it('should extract JSON from text with extra content', () => {
      const textWithExtra = 'Here is the JSON: {"name": "John", "age": 30} - end of text'
      const result = sanitizeAiJson(textWithExtra)
      expect(result).toEqual({ name: 'John', age: 30 })
    })

    it('should handle JSON with markdown code blocks', () => {
      const markdownJson = '```json\n{"name": "John", "age": 30}\n```'
      const result = sanitizeAiJson(markdownJson)
      expect(result).toEqual({ name: 'John', age: 30 })
    })

    it('should normalize newlines', () => {
      const jsonWithNewlines = '{\n"name": "John",\r\n"age": 30\r}'
      const result = sanitizeAiJson(jsonWithNewlines)
      expect(result).toEqual({ name: 'John', age: 30 })
    })

    it('should normalize tabs to spaces', () => {
      const jsonWithTabs = '{\t"name": "John",\t"age": 30}'
      const result = sanitizeAiJson(jsonWithTabs)
      expect(result).toEqual({ name: 'John', age: 30 })
    })

    it('should fix unescaped quotes in strings', () => {
      const jsonWithUnescapedQuotes = '{"text": "He said "hello""}'
      const result = sanitizeAiJson(jsonWithUnescapedQuotes)
      expect(result.text).toBe('He said "hello"')
    })

    it('should remove trailing commas', () => {
      const jsonWithTrailingComma = '{"name": "John", "age": 30,}'
      const result = sanitizeAiJson(jsonWithTrailingComma)
      expect(result).toEqual({ name: 'John', age: 30 })
    })

    it('should fix missing commas between string values and keys', () => {
      const jsonWithMissingComma = '{"name": "John" "age": 30}'
      const result = sanitizeAiJson(jsonWithMissingComma)
      expect(result).toEqual({ name: 'John', age: 30 })
    })

    it('should remove misplaced colons', () => {
      const jsonWithMisplacedColon = '{"name": "John", : "age": 30}'
      const result = sanitizeAiJson(jsonWithMisplacedColon)
      expect(result.name).toBe('John')
    })

    it('should handle arrays', () => {
      const jsonArray = '[{"name": "John"}, {"name": "Jane"}]'
      const result = sanitizeAiJson(jsonArray)
      expect(result).toEqual([{ name: 'John' }, { name: 'Jane' }])
    })

    it('should throw error when no JSON object found', () => {
      const noJson = 'This is just text without JSON'
      expect(() => sanitizeAiJson(noJson)).toThrow('No JSON object found in AI output')
    })

    it('should handle nested objects', () => {
      const nestedJson = '{"user": {"name": "John", "address": {"city": "NYC"}}}'
      const result = sanitizeAiJson(nestedJson)
      expect(result).toEqual({
        user: {
          name: 'John',
          address: {
            city: 'NYC',
          },
        },
      })
    })

    it('should handle control characters', () => {
      const jsonWithControlChars = '{"name": "John\x00\x01\x02", "age": 30}'
      const result = sanitizeAiJson(jsonWithControlChars)
      expect(result.name).toBe('John')
    })

    it('should handle escaped newlines in strings', () => {
      const jsonWithEscapedNewline = '{"text": "Line 1\\nLine 2"}'
      const result = sanitizeAiJson(jsonWithEscapedNewline)
      expect(result.text).toContain('\n')
    })

    it('should handle complex real-world example', () => {
      const complexJson = `
        Here's the response:
        {
          "name": "John Doe",
          "age": 30,
          "email": "john@example.com",
          "bio": "He said "hello" to me",
          "skills": ["JavaScript", "TypeScript"]
        }
        That's all!
      `
      const result = sanitizeAiJson(complexJson)
      expect(result.name).toBe('John Doe')
      expect(result.age).toBe(30)
      expect(result.skills).toEqual(['JavaScript', 'TypeScript'])
    })
  })
})
