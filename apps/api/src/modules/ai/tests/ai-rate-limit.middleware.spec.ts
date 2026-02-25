import type { LanguageModel, LanguageModelMiddleware } from 'ai'
import type Pino from 'pino'
import pino from 'pino'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { withRetryAfter, wrapWithRetryAfter } from '../ai-rate-limit.middleware'

type WrapGenerateContext = Parameters<NonNullable<LanguageModelMiddleware['wrapGenerate']>>[0]
type WrapStreamContext = Parameters<NonNullable<LanguageModelMiddleware['wrapStream']>>[0]
type GenerateResult = Awaited<ReturnType<NonNullable<LanguageModelMiddleware['wrapGenerate']>>>
type StreamResult = Awaited<ReturnType<NonNullable<LanguageModelMiddleware['wrapStream']>>>

describe('ai-rate-limit.middleware', () => {
  let mockLogger: Pino.Logger
  const mockModel = { provider: 'openai', modelId: 'gpt-4' } as LanguageModel
  const mockParams = {} as WrapGenerateContext['params']

  const createGenerateContext = (doGenerate: () => PromiseLike<GenerateResult>): WrapGenerateContext =>
    ({
      doGenerate,
      doStream: vi.fn(),
      params: mockParams,
      model: mockModel as WrapGenerateContext['model'],
    })

  const createStreamContext = (doStream: () => PromiseLike<StreamResult>): WrapStreamContext =>
    ({
      doGenerate: vi.fn(),
      doStream,
      params: mockParams,
      model: mockModel as WrapStreamContext['model'],
    })

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    vi.clearAllTimers()
    mockLogger = {
      warn: vi.fn(),
      error: vi.fn(),
      log: vi.fn(),
    } as unknown as Pino.Logger
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('withRetryAfter - wrapGenerate', () => {
    it('should succeed on first attempt', async () => {
      const middleware = withRetryAfter({}, pino())
      const mockDoGenerate = vi.fn().mockResolvedValue({ text: 'success' })

      const result = await middleware.wrapGenerate!(createGenerateContext(mockDoGenerate))

      expect(result).toEqual({ text: 'success' })
      expect(mockDoGenerate).toHaveBeenCalledTimes(1)
    })

    it('should retry on 429 status error', async () => {
      const middleware = withRetryAfter({ maxRetries: 2, baseDelay: 100 }, mockLogger)
      const rateLimitError = { status: 429, message: 'Rate limit exceeded' }
      const mockDoGenerate = vi.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue({ text: 'success' })

      const resultPromise = middleware.wrapGenerate!(createGenerateContext(mockDoGenerate))

      // Fast-forward timers to skip delay
      await vi.advanceTimersByTimeAsync(200)

      const result = await resultPromise

      expect(result).toEqual({ text: 'success' })
      expect(mockDoGenerate).toHaveBeenCalledTimes(2)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Rate limit hit'),
        expect.objectContaining({
          retryCount: 1,
          maxRetries: 2,
        }),
      )
    })

    it('should retry on error with rate limit message', async () => {
      const middleware = withRetryAfter({ maxRetries: 1, baseDelay: 100 }, mockLogger)
      const rateLimitError = new Error('rate limit exceeded')
      const mockDoGenerate = vi.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue({ text: 'success' })

      const resultPromise = middleware.wrapGenerate!(createGenerateContext(mockDoGenerate))

      await vi.advanceTimersByTimeAsync(200)

      const result = await resultPromise

      expect(result).toEqual({ text: 'success' })
      expect(mockDoGenerate).toHaveBeenCalledTimes(2)
    })

    it('should retry on error with 429 in message', async () => {
      const middleware = withRetryAfter({ maxRetries: 1, baseDelay: 100 }, mockLogger)
      const rateLimitError = new Error('Error 429: Too many requests')
      const mockDoGenerate = vi.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue({ text: 'success' })

      const resultPromise = middleware.wrapGenerate!(createGenerateContext(mockDoGenerate))

      await vi.advanceTimersByTimeAsync(200)

      const result = await resultPromise

      expect(result).toEqual({ text: 'success' })
      expect(mockDoGenerate).toHaveBeenCalledTimes(2)
    })

    it('should retry on error with rate_limit_exceeded code', async () => {
      const middleware = withRetryAfter({ maxRetries: 1, baseDelay: 100 }, mockLogger)
      const rateLimitError = { code: 'rate_limit_exceeded', message: 'Rate limit' }
      const mockDoGenerate = vi.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue({ text: 'success' })

      const resultPromise = middleware.wrapGenerate!(createGenerateContext(mockDoGenerate))

      await vi.advanceTimersByTimeAsync(200)

      const result = await resultPromise

      expect(result).toEqual({ text: 'success' })
      expect(mockDoGenerate).toHaveBeenCalledTimes(2)
    })

    it('should use retry-after header when available', async () => {
      const middleware = withRetryAfter({ maxRetries: 1, baseDelay: 100 }, mockLogger)
      const rateLimitError = {
        status: 429,
        response: {
          headers: {
            'retry-after': '5',
          },
        },
      }
      const mockDoGenerate = vi.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue({ text: 'success' })

      const resultPromise = middleware.wrapGenerate!(createGenerateContext(mockDoGenerate))

      // Should wait 5 seconds (5000ms) from retry-after header
      await vi.advanceTimersByTimeAsync(5000)

      const result = await resultPromise

      expect(result).toEqual({ text: 'success' })
      expect(mockDoGenerate).toHaveBeenCalledTimes(2)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Rate limit hit'),
        expect.objectContaining({
          retryAfter: '5',
        }),
      )
    })

    it('should use retry-after from headers.get() method', async () => {
      const middleware = withRetryAfter({ maxRetries: 1, baseDelay: 100 }, mockLogger)
      const rateLimitError = {
        status: 429,
        headers: {
          get: vi.fn().mockReturnValue('3'),
        },
      }
      const mockDoGenerate = vi.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue({ text: 'success' })

      const resultPromise = middleware.wrapGenerate!(createGenerateContext(mockDoGenerate))

      // Should wait 3 seconds (3000ms) from retry-after header
      await vi.advanceTimersByTimeAsync(3000)

      const result = await resultPromise

      expect(result).toEqual({ text: 'success' })
      expect(mockDoGenerate).toHaveBeenCalledTimes(2)
    })

    it('should use exponential backoff when no retry-after header', async () => {
      const middleware = withRetryAfter({ maxRetries: 2, baseDelay: 100 }, mockLogger)
      const rateLimitError = { status: 429 }
      const mockDoGenerate = vi.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue({ text: 'success' })

      const resultPromise = middleware.wrapGenerate!(createGenerateContext(mockDoGenerate))

      // First retry: baseDelay * 2^0 = 100ms (plus jitter, but we'll advance more)
      await vi.advanceTimersByTimeAsync(200)
      // Second retry: baseDelay * 2^1 = 200ms (plus jitter)
      await vi.advanceTimersByTimeAsync(300)

      const result = await resultPromise

      expect(result).toEqual({ text: 'success' })
      expect(mockDoGenerate).toHaveBeenCalledTimes(3)
    })

    it('should throw error after max retries exceeded', async () => {
      const middleware = withRetryAfter({ maxRetries: 1, baseDelay: 100 }, mockLogger)
      const rateLimitError = { status: 429, message: 'Rate limit exceeded' }
      const mockDoGenerate = vi.fn().mockRejectedValue(rateLimitError)

      const resultPromise = middleware.wrapGenerate!(createGenerateContext(mockDoGenerate))
      // Attach catch handler immediately to prevent unhandled rejection warning
      Promise.resolve(resultPromise).catch(() => {})

      await vi.advanceTimersByTimeAsync(200)

      await expect(resultPromise).rejects.toEqual(rateLimitError)
      expect(mockDoGenerate).toHaveBeenCalledTimes(2) // Initial + 1 retry
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Rate limit exceeded after'),
        expect.objectContaining({
          error: 'Unknown error',
        }),
      )
    })

    it('should not retry non-rate-limit errors', async () => {
      const middleware = withRetryAfter({ maxRetries: 2 }, mockLogger)
      const otherError = new Error('Some other error')
      const mockDoGenerate = vi.fn().mockRejectedValue(otherError)

      await expect(middleware.wrapGenerate!(createGenerateContext(mockDoGenerate))).rejects.toThrow('Some other error')

      expect(mockDoGenerate).toHaveBeenCalledTimes(1)
      expect(mockLogger.warn).not.toHaveBeenCalled()
    })

    it('should respect custom shouldRetry function', async () => {
      const customShouldRetry = vi.fn().mockReturnValue(false)
      const middleware = withRetryAfter({ shouldRetry: customShouldRetry }, mockLogger)
      const rateLimitError = { status: 429 }
      const mockDoGenerate = vi.fn().mockRejectedValue(rateLimitError)

      await expect(middleware.wrapGenerate!(createGenerateContext(mockDoGenerate))).rejects.toEqual(rateLimitError)

      expect(customShouldRetry).toHaveBeenCalledWith(rateLimitError)
      expect(mockDoGenerate).toHaveBeenCalledTimes(1)
    })

    it('should use custom calculateDelay function', async () => {
      const customCalculateDelay = vi.fn().mockReturnValue(500)
      const middleware = withRetryAfter({
        maxRetries: 1,
        calculateDelay: customCalculateDelay,
      }, mockLogger)
      const rateLimitError = { status: 429 }
      const mockDoGenerate = vi.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue({ text: 'success' })

      const resultPromise = middleware.wrapGenerate!(createGenerateContext(mockDoGenerate))

      await vi.advanceTimersByTimeAsync(500)

      const result = await resultPromise

      expect(result).toEqual({ text: 'success' })
      expect(customCalculateDelay).toHaveBeenCalledWith(0, undefined)
      expect(mockDoGenerate).toHaveBeenCalledTimes(2)
    })
  })

  describe('withRetryAfter - wrapStream', () => {
    it('should succeed on first attempt', async () => {
      const middleware = withRetryAfter({}, mockLogger)
      const mockStream = {
        async* [Symbol.asyncIterator]() {
          yield 'chunk'
        },
      }
      const mockDoStream = vi.fn().mockResolvedValue(mockStream)

      const result = await middleware.wrapStream!(createStreamContext(mockDoStream))

      expect(result).toBe(mockStream)
      expect(mockDoStream).toHaveBeenCalledTimes(1)
    })

    it('should retry on rate limit error', async () => {
      const middleware = withRetryAfter({ maxRetries: 1, baseDelay: 100 }, mockLogger)
      const rateLimitError = { status: 429 }
      const mockStream = {
        async* [Symbol.asyncIterator]() {
          yield 'chunk'
        },
      }
      const mockDoStream = vi.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue(mockStream)

      const resultPromise = middleware.wrapStream!(createStreamContext(mockDoStream))

      await vi.advanceTimersByTimeAsync(200)

      const result = await resultPromise

      expect(result).toBe(mockStream)
      expect(mockDoStream).toHaveBeenCalledTimes(2)
    })

    it('should throw error after max retries exceeded', async () => {
      const middleware = withRetryAfter({ maxRetries: 1, baseDelay: 100 }, mockLogger)
      const rateLimitError = { status: 429 }
      const mockDoStream = vi.fn().mockRejectedValue(rateLimitError)

      const resultPromise = middleware.wrapStream!(createStreamContext(mockDoStream))
      // Attach catch handler immediately to prevent unhandled rejection warning
      Promise.resolve(resultPromise).catch(() => {})

      await vi.advanceTimersByTimeAsync(200)

      await expect(resultPromise).rejects.toEqual(rateLimitError)
      expect(mockDoStream).toHaveBeenCalledTimes(2) // Initial + 1 retry
    })
  })

  describe('wrapWithRetryAfter', () => {
    it('should wrap model with retry middleware', () => {
      const mockModel = {
        provider: 'openai',
        modelId: 'gpt-4',
      } as LanguageModel

      const wrappedModel = wrapWithRetryAfter(mockModel, pino(), { maxRetries: 5 })

      expect(wrappedModel).toBeDefined()
      expect(wrappedModel).not.toBe(mockModel)
    })

    it('should use custom options', () => {
      const mockModel = {
        provider: 'openai',
        modelId: 'gpt-4',
      } as LanguageModel

      const wrappedModel = wrapWithRetryAfter(mockModel, mockLogger, { maxRetries: 5 })

      expect(wrappedModel).toBeDefined()
    })
  })

  describe('edge cases', () => {
    it('should handle error without status or message', async () => {
      const middleware = withRetryAfter({ maxRetries: 1 }, mockLogger)
      const error = {}
      const mockDoGenerate = vi.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue({ text: 'success' })

      // Should not retry since error doesn't match rate limit criteria
      await expect(middleware.wrapGenerate!(createGenerateContext(mockDoGenerate))).rejects.toEqual(error)

      expect(mockDoGenerate).toHaveBeenCalledTimes(1)
    })

    it('should handle error with invalid retry-after header', async () => {
      const middleware = withRetryAfter({ maxRetries: 1, baseDelay: 100 }, mockLogger)
      const rateLimitError = {
        status: 429,
        headers: {
          'retry-after': 'invalid',
        },
      }
      const mockDoGenerate = vi.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue({ text: 'success' })

      const resultPromise = middleware.wrapGenerate!(createGenerateContext(mockDoGenerate))

      // Should fall back to exponential backoff
      await vi.advanceTimersByTimeAsync(200)

      const result = await resultPromise

      expect(result).toEqual({ text: 'success' })
      expect(mockDoGenerate).toHaveBeenCalledTimes(2)
    })

    it('should handle null error', async () => {
      const middleware = withRetryAfter({ maxRetries: 1 }, mockLogger)
      const mockDoGenerate = vi.fn().mockRejectedValue(null)

      await expect(middleware.wrapGenerate!(createGenerateContext(mockDoGenerate))).rejects.toBeNull()

      expect(mockDoGenerate).toHaveBeenCalledTimes(1)
    })
  })
})
