import type { LanguageModel, Tool } from 'ai'
import * as langfuseTracing from '@langfuse/tracing'
import { Test, TestingModule } from '@nestjs/testing'
import { generateText } from 'ai'
import { z } from 'zod'
import { modelRegistry } from '../ai.config'
import { AiService } from '../ai.service'
import { getDefaultModel, getModel, sanitizeAiJson } from '../ai.utils'
import { LangfuseService } from '../langfuse.service'

// Mock dependencies
jest.mock('ai', () => ({
  generateText: jest.fn(),
  stepCountIs: jest.fn((count: number) => () => count),
}))

jest.mock('@langfuse/tracing', () => {
  const createTraceIdMock = jest.fn().mockResolvedValue('test-trace-id')
  return {
    getActiveSpanId: jest.fn(),
    getActiveTraceId: jest.fn(),
    startActiveObservation: jest.fn((name, fn) => fn()),
    updateActiveTrace: jest.fn(),
    createTraceId: createTraceIdMock,
  }
})

jest.mock('../ai.utils', () => ({
  getModel: jest.fn(),
  getDefaultModel: jest.fn(),
  sanitizeAiJson: jest.fn((text: string) => JSON.parse(text)),
}))

jest.mock('../langfuse.service')

jest.mock('../ai.config', () => ({
  modelRegistry: {
    register: jest.fn(),
    get: jest.fn(),
    getDefault: jest.fn(),
    getAll: jest.fn(() => []),
    has: jest.fn(),
  },
  modelConfigBase: {
    OPENAI_GPT_5_NANO: {
      modelString: 'gpt-5-nano-2025-08-07',
      provider: 'openai',
      isDefault: false,
    },
  },
}))

jest.mock('../../../config/env.config', () => ({
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
  let mockLangfuseService: jest.Mocked<LangfuseService>

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks()

    // Setup mock model
    mockModel = {
      provider: 'openai',
      modelId: 'gpt-5-nano-2025-08-07',
    } as LanguageModel

    // Setup LangfuseService mock
    mockLangfuseService = {
      executeTracedGeneration: jest.fn(),
      getLangfusePrompt: jest.fn(),
    } as unknown as jest.Mocked<LangfuseService>

    // Reset createTraceId mock
    ;(langfuseTracing.createTraceId as jest.Mock).mockResolvedValue('test-trace-id')

    ;(getModel as jest.Mock).mockResolvedValue(mockModel)
    ;(getDefaultModel as jest.Mock).mockResolvedValue(mockModel)
    ;(modelRegistry.get as jest.Mock).mockReturnValue({
      provider: 'openai',
      modelString: 'gpt-5-nano-2025-08-07',
    })
    ;(modelRegistry.getDefault as jest.Mock).mockReturnValue('OPENAI_GPT_5_NANO')

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
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('onModuleInit', () => {
    it('should register default models', () => {
      const registerSpy = jest.spyOn(modelRegistry, 'register')
      service.onModuleInit()
      expect(registerSpy).toHaveBeenCalled()
    })
  })

  describe('generateText', () => {
    it('should generate text from prompt', async () => {
      const mockResult = {
        text: 'Hello, world!',
        usage: {
          inputTokens: 10,
          outputTokens: 5,
          totalTokens: 15,
        },
        finishReason: 'stop',
        steps: [],
      }

      ;(generateText as jest.Mock).mockResolvedValue(mockResult)

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
      const mockResult = {
        text: 'Test response',
        usage: {
          inputTokens: 5,
          outputTokens: 3,
          totalTokens: 8,
        },
        finishReason: 'stop',
        steps: [],
      }

      ;(generateText as jest.Mock).mockResolvedValue(mockResult)

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
      const mockResult = {
        text: 'Default model response',
        usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
        finishReason: 'stop',
        steps: [],
      }

      ;(generateText as jest.Mock).mockResolvedValue(mockResult)

      await service.generateText({
        prompt: 'Test',
      })

      expect(getDefaultModel).toHaveBeenCalled()
    })

    it('should use specified model when provided', async () => {
      const mockResult = {
        text: 'Model response',
        usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
        finishReason: 'stop',
        steps: [],
      }

      ;(generateText as jest.Mock).mockResolvedValue(mockResult)

      await service.generateText({
        prompt: 'Test',
        model: 'OPENAI_GPT_5_NANO',
      })

      expect(getModel).toHaveBeenCalledWith('OPENAI_GPT_5_NANO')
    })

    it('should throw error when no default model is configured', async () => {
      ;(getDefaultModel as jest.Mock).mockResolvedValue(null)

      await expect(
        service.generateText({
          prompt: 'Test',
        }),
      ).rejects.toThrow('No default model configured. Please specify a model or configure a default model.')
    })

    it('should handle abort signal', async () => {
      const abortController = new AbortController()
      const signal = abortController.signal

      const mockResult = {
        text: 'Response',
        usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
        finishReason: 'stop',
        steps: [],
      }

      ;(generateText as jest.Mock).mockResolvedValue(mockResult)

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
      const mockResult = {
        text: 'Response',
        usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
        finishReason: 'stop',
        steps: [],
      }

      ;(generateText as jest.Mock).mockResolvedValue(mockResult)

      const result = await service.generateText({
        prompt: 'Test',
      })

      expect(result.abortController).toBeDefined()
      expect(result.abortController).toBeInstanceOf(AbortController)
    })

    it('should handle missing usage data', async () => {
      const mockResult = {
        text: 'Response',
        usage: undefined,
        finishReason: 'stop',
        steps: [],
      }

      ;(generateText as jest.Mock).mockResolvedValue(mockResult)

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
      const mockResult = {
        text: mockJsonText,
        usage: {
          inputTokens: 20,
          outputTokens: 10,
          totalTokens: 30,
        },
        finishReason: 'stop',
        steps: [],
      }

      ;(generateText as jest.Mock).mockResolvedValue(mockResult)

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

      const mockResult = {
        text: 'Invalid JSON',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        finishReason: 'stop',
        steps: [],
      }

      ;(generateText as jest.Mock).mockResolvedValue(mockResult)

      // Mock sanitizeAiJson to throw error
      ;(sanitizeAiJson as jest.Mock).mockImplementation(() => {
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
      // Reset sanitizeAiJson mock from previous test
      ;(sanitizeAiJson as jest.Mock).mockImplementation((text: string) => JSON.parse(text))

      const schema = z.object({ name: z.string() })
      const mockResult = {
        text: '{"name": "Test"}',
        usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
        finishReason: 'stop',
        steps: [],
      }

      ;(generateText as jest.Mock).mockResolvedValue(mockResult)

      await service.generateObject({
        prompt: 'Test',
        schema,
        model: 'OPENAI_GPT_5_NANO',
      })

      expect(getModel).toHaveBeenCalledWith('OPENAI_GPT_5_NANO')
    })
  })

  describe('chat', () => {
    it('should chat with messages array', async () => {
      const mockResult = {
        text: 'Hello!',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        finishReason: 'stop',
        steps: [],
      }

      ;(generateText as jest.Mock).mockResolvedValue(mockResult)

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
        execute: jest.fn(),
      } as Tool

      const mockResult = {
        text: 'Tool response',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        finishReason: 'stop',
        steps: [
          {
            toolCalls: [
              {
                toolCallId: 'call-1',
                toolName: 'testTool',
                input: { arg: 'value' },
              },
            ],
            toolResults: [
              {
                toolCallId: 'call-1',
                toolName: 'testTool',
                output: { result: 'success' },
              },
            ],
          },
        ],
      }

      ;(generateText as jest.Mock).mockResolvedValue(mockResult)

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
      const mockResult = {
        text: 'Response',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        finishReason: 'stop',
        steps: [
          {
            toolCalls: [
              {
                toolCallId: 'call-1',
                toolName: 'testTool',
                input: { arg: 'value' },
              },
            ],
          },
        ],
      }

      ;(generateText as jest.Mock).mockResolvedValue(mockResult)

      const mockEmptyTool: Tool = {
        description: 'Empty tool',
        inputSchema: z.object({}),
        execute: jest.fn(),
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
      const mockResult = {
        text: 'Response',
        usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
        finishReason: 'stop',
        steps: [],
      }

      ;(generateText as jest.Mock).mockResolvedValue(mockResult)

      await service.chat({
        messages: [{ role: 'user', content: 'Test' }],
        model: 'OPENAI_GPT_5_NANO',
      })

      expect(getModel).toHaveBeenCalledWith('OPENAI_GPT_5_NANO')
    })

    it('should create and return abort controller when signal is not provided', async () => {
      const mockResult = {
        text: 'Response',
        usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
        finishReason: 'stop',
        steps: [],
      }

      ;(generateText as jest.Mock).mockResolvedValue(mockResult)

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

      it('should append schema instruction as system message when schema is provided', async () => {
        const mockResult = {
          text: '{"name": "John", "age": 30}',
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          finishReason: 'stop',
          steps: [],
        }

        ;(generateText as jest.Mock).mockResolvedValue(mockResult)
        ;(sanitizeAiJson as jest.Mock).mockImplementation((text: string) => JSON.parse(text))

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
                role: 'system',
                content: expect.stringContaining('IMPORTANT: You must respond with valid JSON'),
              }),
            ]),
          }),
        )
      })

      it('should validate response against schema and return result as string', async () => {
        const mockResult = {
          text: '{"name": "Jane", "age": 25}',
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          finishReason: 'stop',
          steps: [],
        }

        ;(generateText as jest.Mock).mockResolvedValue(mockResult)
        ;(sanitizeAiJson as jest.Mock).mockImplementation((text: string) => JSON.parse(text))

        const result = await service.chat({
          messages: [{ role: 'user', content: 'Generate a user profile' }],
          schema: userSchema,
        })

        expect(result.result).toBe('{"name": "Jane", "age": 25}')
        expect(typeof result.result).toBe('string')
      })

      it('should include schema instruction in returned messages for traceability', async () => {
        const mockResult = {
          text: '{"name": "Bob", "age": 35}',
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          finishReason: 'stop',
          steps: [],
        }

        ;(generateText as jest.Mock).mockResolvedValue(mockResult)
        ;(sanitizeAiJson as jest.Mock).mockImplementation((text: string) => JSON.parse(text))

        const result = await service.chat({
          messages: [{ role: 'user', content: 'Generate a user profile' }],
          schema: userSchema,
        })

        expect(result.messages).toHaveLength(3)
        expect(result.messages[0].role).toBe('user')
        expect(result.messages[1].role).toBe('system')
        expect(result.messages[1].content).toContain('IMPORTANT: You must respond with valid JSON')
        expect(result.messages[2].role).toBe('assistant')
        expect(result.messages[2].content).toBe('{"name": "Bob", "age": 35}')
      })

      it('should throw error when schema validation fails', async () => {
        const mockResult = {
          text: '{"invalid": "data"}',
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          finishReason: 'stop',
          steps: [],
        }

        ;(generateText as jest.Mock).mockResolvedValue(mockResult)
        ;(sanitizeAiJson as jest.Mock).mockImplementation((text: string) => JSON.parse(text))

        await expect(
          service.chat({
            messages: [{ role: 'user', content: 'Generate a user profile' }],
            schema: userSchema,
          }),
        ).rejects.toThrow('Schema validation failed')
      })

      it('should work without schema (backward compatibility)', async () => {
        const mockResult = {
          text: 'Hello, this is a normal response',
          usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
          finishReason: 'stop',
          steps: [],
        }

        ;(generateText as jest.Mock).mockResolvedValue(mockResult)

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

      ;(generateText as jest.Mock).mockRejectedValue(abortError)

      await expect(
        service.generateText({
          prompt: 'Test',
        }),
      ).rejects.toThrow('Aborted')
    })

    it('should handle general errors in generateText', async () => {
      const error = new Error('Generation failed')
      ;(generateText as jest.Mock).mockRejectedValue(error)

      await expect(
        service.generateText({
          prompt: 'Test',
        }),
      ).rejects.toThrow('Generation failed')
    })
  })

  describe('langfuse integration', () => {
    it('should use generateText directly when telemetry is not provided', async () => {
      const mockResult = {
        text: 'Response',
        usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
        finishReason: 'stop',
        steps: [],
      }

      ;(generateText as jest.Mock).mockResolvedValue(mockResult)

      await service.generateText({
        prompt: 'Test',
      })

      expect(generateText).toHaveBeenCalled()
      expect(mockLangfuseService.executeTracedGeneration).not.toHaveBeenCalled()
    })
  })

  describe('usage tracking', () => {
    it('should calculate total tokens when not provided', async () => {
      const mockResult = {
        text: 'Response',
        usage: {
          inputTokens: 10,
          outputTokens: 5,
        },
        finishReason: 'stop',
        steps: [],
      }

      ;(generateText as jest.Mock).mockResolvedValue(mockResult)

      const result = await service.generateText({
        prompt: 'Test',
      })

      expect(result.usage?.totalTokens).toBe(15)
    })
  })

  describe('options', () => {
    it('should pass all options to generateText', async () => {
      const mockResult = {
        text: 'Response',
        usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
        finishReason: 'stop',
        steps: [],
      }

      ;(generateText as jest.Mock).mockResolvedValue(mockResult)

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
