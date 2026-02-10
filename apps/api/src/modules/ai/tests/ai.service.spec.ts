import type { LanguageModel, Tool } from 'ai'
import type { Mocked } from 'vitest'
import * as langfuseTracing from '@langfuse/tracing'
import { Test, TestingModule } from '@nestjs/testing'
import { generateText } from 'ai'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { modelRegistry } from '../ai.config'
import { AiService } from '../ai.service'
import { getModelInstance, validateAndParse } from '../ai.utils'
import { LangfuseService } from '../langfuse.service'

type GenerateTextResult = Awaited<ReturnType<typeof generateText>>

function createMockGenerateTextResult(overrides?: {
  text?: string
  usage?: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
  }
  finishReason?: string
  steps?: Partial<GenerateTextResult['steps'][number]>[]
  totalUsage?: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
  }
}): GenerateTextResult {
  return {
    text: '',
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      ...overrides?.usage,
    } as GenerateTextResult['usage'],
    finishReason: 'stop',
    steps: [],
    ...overrides,
  } as GenerateTextResult
}

// Mock dependencies
vi.mock('ai', () => ({
  generateText: vi.fn(),
  stepCountIs: vi.fn((count: number) => () => count),
}))

vi.mock('@langfuse/tracing', () => {
  const createTraceIdMock = vi.fn().mockResolvedValue('test-trace-id')
  return {
    getActiveSpanId: vi.fn(),
    getActiveTraceId: vi.fn(),
    startActiveObservation: vi.fn((name, fn) => fn()),
    updateActiveTrace: vi.fn(),
    createTraceId: createTraceIdMock,
  }
})

vi.mock('../ai.utils', () => ({
  getModel: vi.fn(),
  getDefaultModel: vi.fn(),
  getModelInstance: vi.fn(),
  sanitizeAiJson: vi.fn((text: string) => JSON.parse(text)),
  validateAndParse: vi.fn((text: string, schema) => {
    const parsed = JSON.parse(text)
    return schema.parse(parsed)
  }),
  createSchemaPromptCommand: vi.fn(() => 'IMPORTANT: You must respond with valid JSON'),
  createSchemaPromptCommandForChat: vi.fn(() => 'IMPORTANT: You must respond with valid JSON'),
  extractToolCalls: vi.fn((steps) => {
    const toolCalls = steps?.flatMap((step: { toolCalls?: Array<{ toolCallId: string, toolName: string, input: unknown }> }) =>
      (step.toolCalls || []).map(tc => ({
        toolCallId: tc.toolCallId,
        toolName: tc.toolName,
        args: tc.input as Record<string, unknown>,
      })),
    )
    return toolCalls && toolCalls.length > 0 ? toolCalls : undefined
  }),
  extractToolResults: vi.fn((steps) => {
    const toolResults = steps?.flatMap((step: { toolResults?: Array<{ toolCallId: string, toolName: string, output: unknown }> }) =>
      (step.toolResults || []).map(tr => ({
        toolCallId: tr.toolCallId,
        toolName: tr.toolName,
        result: tr.output,
      })),
    )
    return toolResults && toolResults.length > 0 ? toolResults : undefined
  }),
}))

vi.mock('../langfuse.service')

vi.mock('../ai.config', () => ({
  modelRegistry: {
    register: vi.fn(),
    get: vi.fn(),
    getDefault: vi.fn(),
    getAll: vi.fn(() => []),
    has: vi.fn(),
  },
  modelConfigBase: {
    OPENAI_GPT_5_NANO: {
      modelString: 'gpt-5-nano-2025-08-07',
      provider: 'openai',
      isDefault: false,
    },
  },
}))

vi.mock('../../../config/env.config', () => ({
  config: {
    langfuse: {
      secretKey: 'test-secret-key',
      publicKey: 'test-public-key',
      host: 'https://test.langfuse.com',
    },
  },
}))

describe('aiService', () => {
  let service: AiService
  let mockModel: LanguageModel
  let mockLangfuseService: Mocked<LangfuseService>

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks()

    // Setup mock model
    mockModel = {
      provider: 'openai',
      modelId: 'gpt-5-nano-2025-08-07',
    } as LanguageModel

    // Setup LangfuseService mock
    mockLangfuseService = {
      executeTracedGeneration: vi.fn(),
      getLangfusePrompt: vi.fn(),
    } as unknown as Mocked<LangfuseService>

    // Reset createTraceId mock
    vi.mocked(langfuseTracing.createTraceId).mockResolvedValue('test-trace-id')

    vi.mocked(getModelInstance).mockResolvedValue(mockModel)
    vi.mocked(modelRegistry.get).mockReturnValue({
      provider: 'openai',
      modelString: 'gpt-5-nano-2025-08-07',
      isDefault: false,
    })
    vi.mocked(modelRegistry.getDefault).mockReturnValue('OPENAI_GPT_5_NANO')

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: LangfuseService,
          useValue: mockLangfuseService,
        },
      ],
    }).compile()

    service = module.get<AiService>(AiService)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('onModuleInit', () => {
    it('should register default models', () => {
      const registerSpy = vi.spyOn(modelRegistry, 'register')
      service.onModuleInit()
      expect(registerSpy).toHaveBeenCalled()
    })
  })

  describe('generateText', () => {
    it('should generate text from prompt', async () => {
      const mockResult = createMockGenerateTextResult({
        text: 'Hello, world!',
        usage: {
          inputTokens: 10,
          outputTokens: 5,
          totalTokens: 15,
        },
        finishReason: 'stop',
      })

      vi.mocked(generateText).mockResolvedValue(mockResult)

      const result = await service.generateText({
        prompt: 'Say hello',
      })

      expect(result.result).toBe('Hello, world!')
      expect(result.usage).toEqual({
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      })
      expect(result.finishReason).toBe('stop')
      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          model: mockModel,
          prompt: 'Say hello',
        }),
      )
    })

    it('should generate text with options', async () => {
      const mockResult = createMockGenerateTextResult({
        text: 'Test response',
        usage: {
          inputTokens: 5,
          outputTokens: 3,
          totalTokens: 8,
        },
        finishReason: 'stop',
      })

      vi.mocked(generateText).mockResolvedValue(mockResult)

      const result = await service.generateText({
        prompt: 'Test prompt',
        options: {
          temperature: 0.7,
          maxTokens: 100,
          topP: 0.9,
        },
      })

      expect(result.result).toBe('Test response')
      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.7,
          maxTokens: 100,
          topP: 0.9,
        }),
      )
    })

    it('should use default model when model is not specified', async () => {
      const mockResult = createMockGenerateTextResult({
        text: 'Default model response',
        usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
        finishReason: 'stop',
      })

      vi.mocked(generateText).mockResolvedValue(mockResult)

      await service.generateText({
        prompt: 'Test',
      })

      // getModelInstance is called without a model parameter, which internally uses getDefaultModel
      expect(getModelInstance).toHaveBeenCalledWith(undefined)
    })

    it('should use specified model when provided', async () => {
      const mockResult = createMockGenerateTextResult({
        text: 'Model response',
        usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
        finishReason: 'stop',
      })

      vi.mocked(generateText).mockResolvedValue(mockResult)

      await service.generateText({
        prompt: 'Test',
        model: 'OPENAI_GPT_5_NANO',
      })

      expect(getModelInstance).toHaveBeenCalledWith('OPENAI_GPT_5_NANO')
    })

    it('should throw error when no default model is configured', async () => {
      vi.mocked(getModelInstance).mockRejectedValue(
        new Error('No default model configured. Please specify a model or configure a default model.'),
      )

      await expect(
        service.generateText({
          prompt: 'Test',
        }),
      ).rejects.toThrow('No default model configured. Please specify a model or configure a default model.')
    })

    it('should handle abort signal', async () => {
      const abortController = new AbortController()
      const signal = abortController.signal

      const mockResult = createMockGenerateTextResult({
        text: 'Response',
        usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
        finishReason: 'stop',
      })

      vi.mocked(generateText).mockResolvedValue(mockResult)

      const result = await service.generateText({
        prompt: 'Test',
        signal,
      })

      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          abortSignal: signal,
        }),
      )
      // When signal is provided, abortController should be undefined
      expect(result.abortController).toBeUndefined()
    })

    it('should create and return abort controller when signal is not provided', async () => {
      const mockResult = createMockGenerateTextResult({
        text: 'Response',
        usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
        finishReason: 'stop',
      })

      vi.mocked(generateText).mockResolvedValue(mockResult)

      const result = await service.generateText({
        prompt: 'Test',
      })

      expect(result.abortController).toBeDefined()
      expect(result.abortController).toBeInstanceOf(AbortController)
    })

    it('should handle missing usage data', async () => {
      const mockResult = createMockGenerateTextResult({
        text: 'Response',
        usage: undefined,
        finishReason: 'stop',
      })

      vi.mocked(generateText).mockResolvedValue(mockResult)

      const result = await service.generateText({
        prompt: 'Test',
      })

      expect(result.usage).toBeUndefined()
    })
  })

  describe('generateObject', () => {
    it('should generate object with schema', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      })

      const mockJsonText = '{"name": "John", "age": 30}'
      const mockResult = createMockGenerateTextResult({
        text: mockJsonText,
        usage: {
          inputTokens: 20,
          outputTokens: 10,
          totalTokens: 30,
        },
        finishReason: 'stop',
      })

      vi.mocked(generateText).mockResolvedValue(mockResult)

      const result = await service.generateObject({
        prompt: 'Create a person',
        schema,
      })

      expect(result.result).toEqual({ name: 'John', age: 30 })
      expect(result.usage).toEqual({
        promptTokens: 20,
        completionTokens: 10,
        totalTokens: 30,
      })
      expect(generateText).toHaveBeenCalled()
    })

    it('should throw error when schema validation fails', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      })

      const mockResult = createMockGenerateTextResult({
        text: 'Invalid JSON',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        finishReason: 'stop',
      })

      vi.mocked(generateText).mockResolvedValue(mockResult)

      // Mock validateAndParse to throw error
      vi.mocked(validateAndParse).mockImplementation(() => {
        throw new Error('Invalid JSON')
      })

      await expect(
        service.generateObject({
          prompt: 'Create a person',
          schema,
        }),
      ).rejects.toThrow('Schema validation failed')
    })

    it('should use specified model', async () => {
      // Reset validateAndParse mock from previous test
      vi.mocked(validateAndParse).mockImplementation((text: string, schema) => {
        const parsed = JSON.parse(text)
        return schema.parse(parsed)
      })

      const schema = z.object({ name: z.string() })
      const mockResult = createMockGenerateTextResult({
        text: '{"name": "Test"}',
        usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
        finishReason: 'stop',
      })

      vi.mocked(generateText).mockResolvedValue(mockResult)

      await service.generateObject({
        prompt: 'Test',
        schema,
        model: 'OPENAI_GPT_5_NANO',
      })

      expect(getModelInstance).toHaveBeenCalledWith('OPENAI_GPT_5_NANO')
    })
  })

  describe('chat', () => {
    it('should chat with messages array', async () => {
      const mockResult = createMockGenerateTextResult({
        text: 'Hello!',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        finishReason: 'stop',
        totalUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } as GenerateTextResult['totalUsage'],
      })

      vi.mocked(generateText).mockResolvedValue(mockResult)

      const result = await service.chat({
        messages: [
          { role: 'user', content: 'Hello' },
        ],
      })

      expect(result.result).toBe('Hello!')
      expect(result.messages).toBeDefined()
      expect(result.messages).toHaveLength(2)
      expect(result.messages[0].role).toBe('user')
      expect(result.messages[1].role).toBe('assistant')
      expect(result.messages[1].content).toBe('Hello!')
      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: 'Hello',
            }),
          ]),
        }),
      )
    })

    it('should chat with tools', async () => {
      const mockTool: Tool = {
        description: 'Test tool',
        inputSchema: z.object({}),
        execute: vi.fn(),
      } as Tool

      const mockResult = createMockGenerateTextResult({
        text: 'Tool response',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        finishReason: 'stop',
        steps: [
          {
            toolCalls: [
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'testTool',
                input: { arg: 'value' },
              },
            ],
            toolResults: [
              {
                type: 'tool-result',
                toolCallId: 'call-1',
                toolName: 'testTool',
                input: { arg: 'value' },
                output: { result: 'success' },
              },
            ],
          } as GenerateTextResult['steps'][number],
        ],
        totalUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } as GenerateTextResult['totalUsage'],
      })

      vi.mocked(generateText).mockResolvedValue(mockResult)

      const result = await service.chat({
        messages: [{ role: 'user', content: 'Use a tool' }],
        tools: {
          testTool: mockTool,
        },
      })

      expect(result.toolCalls).toBeDefined()
      expect(result.toolCalls).toHaveLength(1)
      expect(result.toolCalls![0].toolName).toBe('testTool')
      expect(result.toolCalls![0].args).toEqual({ arg: 'value' })
      expect(result.toolResults).toBeDefined()
      expect(result.toolResults).toHaveLength(1)
      expect(result.toolResults![0].result).toEqual({ result: 'success' })
      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: expect.objectContaining({
            testTool: mockTool,
          }),
        }),
      )
    })

    it('should handle tool calls without results', async () => {
      const mockResult = createMockGenerateTextResult({
        text: 'Response',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        finishReason: 'stop',
        steps: [
          {
            toolCalls: [
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'testTool',
                input: { arg: 'value' },
              },
            ],
          } as GenerateTextResult['steps'][number],
        ],
        totalUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } as GenerateTextResult['totalUsage'],
      })

      vi.mocked(generateText).mockResolvedValue(mockResult)

      const mockEmptyTool: Tool = {
        description: 'Empty tool',
        inputSchema: z.object({}),
        execute: vi.fn(),
      } as Tool

      const result = await service.chat({
        messages: [{ role: 'user', content: 'Use a tool' }],
        tools: {
          testTool: mockEmptyTool,
        },
      })

      expect(result.toolCalls).toBeDefined()
      expect(result.toolResults).toBeUndefined()
    })

    it('should use specified model', async () => {
      const mockResult = createMockGenerateTextResult({
        text: 'Response',
        usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
        finishReason: 'stop',
        totalUsage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 } as GenerateTextResult['totalUsage'],
      })

      vi.mocked(generateText).mockResolvedValue(mockResult)

      await service.chat({
        messages: [{ role: 'user', content: 'Test' }],
        model: 'OPENAI_GPT_5_NANO',
      })

      expect(getModelInstance).toHaveBeenCalledWith('OPENAI_GPT_5_NANO')
    })

    it('should create and return abort controller when signal is not provided', async () => {
      const mockResult = createMockGenerateTextResult({
        text: 'Response',
        usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
        finishReason: 'stop',
        totalUsage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 } as GenerateTextResult['totalUsage'],
      })

      vi.mocked(generateText).mockResolvedValue(mockResult)

      const result = await service.chat({
        messages: [{ role: 'user', content: 'Test' }],
      })

      expect(result.abortController).toBeDefined()
      expect(result.abortController).toBeInstanceOf(AbortController)
    })

    describe('with schema support', () => {
      const userSchema = z.object({
        name: z.string(),
        age: z.number(),
      })

      it('should append schema instruction as assistant message when schema is provided', async () => {
        const mockResult = createMockGenerateTextResult({
          text: '{"name": "John", "age": 30}',
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          finishReason: 'stop',
          totalUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } as GenerateTextResult['totalUsage'],
        })

        vi.mocked(generateText).mockResolvedValue(mockResult)
        vi.mocked(validateAndParse).mockImplementation((text: string, schema) => {
          const parsed = JSON.parse(text)
          return schema.parse(parsed)
        })

        await service.chat({
          messages: [{ role: 'user', content: 'Generate a user profile' }],
          schema: userSchema,
        })

        expect(generateText).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: expect.arrayContaining([
              expect.objectContaining({
                role: 'user',
                content: 'Generate a user profile',
              }),
              expect.objectContaining({
                role: 'assistant',
                content: expect.stringContaining('IMPORTANT: You must respond with valid JSON'),
              }),
            ]),
          }),
        )
      })

      it('should validate response against schema and return result as string', async () => {
        const mockResult = createMockGenerateTextResult({
          text: '{"name": "Jane", "age": 25}',
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          finishReason: 'stop',
          totalUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } as GenerateTextResult['totalUsage'],
        })

        vi.mocked(generateText).mockResolvedValue(mockResult)
        vi.mocked(validateAndParse).mockImplementation((text: string, schema) => {
          const parsed = JSON.parse(text)
          return schema.parse(parsed)
        })

        const result = await service.chat({
          messages: [{ role: 'user', content: 'Generate a user profile' }],
          schema: userSchema,
        })

        expect(result.result).toBe('{"name": "Jane", "age": 25}')
        expect(typeof result.result).toBe('string')
      })

      it('should include schema instruction in returned messages for traceability', async () => {
        const mockResult = createMockGenerateTextResult({
          text: '{"name": "Bob", "age": 35}',
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          finishReason: 'stop',
          totalUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } as GenerateTextResult['totalUsage'],
        })

        vi.mocked(generateText).mockResolvedValue(mockResult)
        vi.mocked(validateAndParse).mockImplementation((text: string, schema) => {
          const parsed = JSON.parse(text)
          return schema.parse(parsed)
        })

        const result = await service.chat({
          messages: [{ role: 'user', content: 'Generate a user profile' }],
          schema: userSchema,
        })

        expect(result.messages).toHaveLength(3)
        expect(result.messages[0].role).toBe('assistant')
        expect(result.messages[0].content).toContain('IMPORTANT: You must respond with valid JSON')
        expect(result.messages[1].role).toBe('user')
        expect(result.messages[2].role).toBe('assistant')
        expect(result.messages[2].content).toBe('{"name": "Bob", "age": 35}')
      })

      it('should throw error when schema validation fails', async () => {
        const mockResult = createMockGenerateTextResult({
          text: '{"invalid": "data"}',
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          finishReason: 'stop',
          totalUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } as GenerateTextResult['totalUsage'],
        })

        vi.mocked(generateText).mockResolvedValue(mockResult)
        vi.mocked(validateAndParse).mockImplementation(() => {
          throw new Error('Validation failed')
        })

        await expect(
          service.chat({
            messages: [{ role: 'user', content: 'Generate a user profile' }],
            schema: userSchema,
          }),
        ).rejects.toThrow('Schema validation failed')
      })

      it('should work without schema (backward compatibility)', async () => {
        const mockResult = createMockGenerateTextResult({
          text: 'Hello, this is a normal response',
          usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
          finishReason: 'stop',
          totalUsage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 } as GenerateTextResult['totalUsage'],
        })

        vi.mocked(generateText).mockResolvedValue(mockResult)

        const result = await service.chat({
          messages: [{ role: 'user', content: 'Say hello' }],
        })

        expect(result.result).toBe('Hello, this is a normal response')
        expect(result.messages).toHaveLength(2)
        expect(result.messages[0].role).toBe('user')
        expect(result.messages[1].role).toBe('assistant')
      })
    })
  })

  describe('error handling', () => {
    it('should handle AbortError in generateText', async () => {
      const abortError = new Error('Aborted')
      abortError.name = 'AbortError'

      vi.mocked(generateText).mockRejectedValue(abortError)

      await expect(
        service.generateText({
          prompt: 'Test',
        }),
      ).rejects.toThrow('Aborted')
    })

    it('should handle general errors in generateText', async () => {
      const error = new Error('Generation failed')
      vi.mocked(generateText).mockRejectedValue(error)

      await expect(
        service.generateText({
          prompt: 'Test',
        }),
      ).rejects.toThrow('Generation failed')
    })
  })

  describe('langfuse integration', () => {
    it('should use generateText directly when telemetry is not provided', async () => {
      const mockResult = createMockGenerateTextResult({
        text: 'Response',
        usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
        finishReason: 'stop',
      })

      vi.mocked(generateText).mockResolvedValue(mockResult)

      await service.generateText({
        prompt: 'Test',
      })

      expect(generateText).toHaveBeenCalled()
      expect(mockLangfuseService.executeTracedGeneration).not.toHaveBeenCalled()
    })
  })

  describe('usage tracking', () => {
    it('should calculate total tokens when not provided', async () => {
      const mockResult = createMockGenerateTextResult({
        text: 'Response',
        usage: {
          inputTokens: 10,
          outputTokens: 5,
        },
        finishReason: 'stop',
      })

      vi.mocked(generateText).mockResolvedValue(mockResult)

      const result = await service.generateText({
        prompt: 'Test',
      })

      expect(result.usage?.totalTokens).toBe(15)
    })
  })

  describe('options', () => {
    it('should pass all options to generateText', async () => {
      const mockResult = createMockGenerateTextResult({
        text: 'Response',
        usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
        finishReason: 'stop',
      })

      vi.mocked(generateText).mockResolvedValue(mockResult)

      await service.generateText({
        prompt: 'Test',
        options: {
          temperature: 0.7,
          maxTokens: 100,
          topP: 0.9,
          frequencyPenalty: 0.5,
          presencePenalty: 0.5,
          maxSteps: 5,
          stopWhen: 3,
        },
      })

      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.7,
          maxTokens: 100,
          topP: 0.9,
          frequencyPenalty: 0.5,
          presencePenalty: 0.5,
          maxSteps: 5,
          stopWhen: expect.any(Function),
          experimental_telemetry: expect.objectContaining({
            isEnabled: true,
            recordInputs: true,
            recordOutputs: true,
          }),
        }),
      )
    })
  })
})
