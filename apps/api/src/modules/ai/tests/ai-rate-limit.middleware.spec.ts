import type { LanguageModel } from 'ai'
import { Logger } from '@nestjs/common'
import { withRetryAfter, wrapWithRetryAfter } from '../ai-rate-limit.middleware'

// Mock sleep to avoid actual delays in tests
jest.useFakeTimers()

describe('ai-rate-limit.middleware', () => {
  let mockLogger: Logger
  const mockModel = { provider: 'openai', modelId: 'gpt-4' } as LanguageModel
  // eslint-disable-next-line ts/no-explicit-any
  const mockParams = {} as any

  // eslint-disable-next-line ts/no-explicit-any
  const createGenerateContext = (doGenerate: () => Promise<unknown>): any =>
    ({
      doGenerate,
      doStream: jest.fn(),
      params: mockParams,
      model: mockModel,
    })

  // eslint-disable-next-line ts/no-explicit-any
  const createStreamContext = (doStream: () => Promise<unknown>): any =>
    ({
      doGenerate: jest.fn(),
      doStream,
      params: mockParams,
      model: mockModel,
    })

  beforeEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
    mockLogger = {
      warn: jest.fn(),
      error: jest.fn(),
      log: jest.fn(),
    } as unknown as Logger
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('withRetryAfter - wrapGenerate', () => {
    it('should succeed on first attempt', async () => {
      const middleware = withRetryAfter({}, mockLogger)
      const mockDoGenerate = jest.fn().mockResolvedValue({ text: 'success' })

      const result = await middleware.wrapGenerate!(createGenerateContext(mockDoGenerate))

      expect(result).toEqual({ text: 'success' })
      expect(mockDoGenerate).toHaveBeenCalledTimes(1)
    })

    it('should retry on 429 status error', async () => {
      const middleware = withRetryAfter({ maxRetries: 2, baseDelay: 100 }, mockLogger)
      const rateLimitError = { status: 429, message: 'Rate limit exceeded' }
      const mockDoGenerate = jest.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue({ text: 'success' })

      const resultPromise = middleware.wrapGenerate!(createGenerateContext(mockDoGenerate))

      // Fast-forward timers to skip delay
      await jest.advanceTimersByTimeAsync(200)

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
      const mockDoGenerate = jest.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue({ text: 'success' })

      const resultPromise = middleware.wrapGenerate!(createGenerateContext(mockDoGenerate))

      await jest.advanceTimersByTimeAsync(200)

      const result = await resultPromise

      expect(result).toEqual({ text: 'success' })
      expect(mockDoGenerate).toHaveBeenCalledTimes(2)
    })

    it('should retry on error with 429 in message', async () => {
      const middleware = withRetryAfter({ maxRetries: 1, baseDelay: 100 }, mockLogger)
      const rateLimitError = new Error('Error 429: Too many requests')
      const mockDoGenerate = jest.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue({ text: 'success' })

      const resultPromise = middleware.wrapGenerate!(createGenerateContext(mockDoGenerate))

      await jest.advanceTimersByTimeAsync(200)

      const result = await resultPromise

      expect(result).toEqual({ text: 'success' })
      expect(mockDoGenerate).toHaveBeenCalledTimes(2)
    })

    it('should retry on error with rate_limit_exceeded code', async () => {
      const middleware = withRetryAfter({ maxRetries: 1, baseDelay: 100 }, mockLogger)
      const rateLimitError = { code: 'rate_limit_exceeded', message: 'Rate limit' }
      const mockDoGenerate = jest.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue({ text: 'success' })

      const resultPromise = middleware.wrapGenerate!(createGenerateContext(mockDoGenerate))

      await jest.advanceTimersByTimeAsync(200)

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
      const mockDoGenerate = jest.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue({ text: 'success' })

      const resultPromise = middleware.wrapGenerate!(createGenerateContext(mockDoGenerate))

      // Should wait 5 seconds (5000ms) from retry-after header
      await jest.advanceTimersByTimeAsync(5000)

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
          get: jest.fn().mockReturnValue('3'),
        },
      }
      const mockDoGenerate = jest.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue({ text: 'success' })

      const resultPromise = middleware.wrapGenerate!(createGenerateContext(mockDoGenerate))

      // Should wait 3 seconds (3000ms) from retry-after header
      await jest.advanceTimersByTimeAsync(3000)

      const result = await resultPromise

      expect(result).toEqual({ text: 'success' })
      expect(mockDoGenerate).toHaveBeenCalledTimes(2)
    })

    it('should use exponential backoff when no retry-after header', async () => {
      const middleware = withRetryAfter({ maxRetries: 2, baseDelay: 100 }, mockLogger)
      const rateLimitError = { status: 429 }
      const mockDoGenerate = jest.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue({ text: 'success' })

      const resultPromise = middleware.wrapGenerate!(createGenerateContext(mockDoGenerate))

      // First retry: baseDelay * 2^0 = 100ms (plus jitter, but we'll advance more)
      await jest.advanceTimersByTimeAsync(200)
      // Second retry: baseDelay * 2^1 = 200ms (plus jitter)
      await jest.advanceTimersByTimeAsync(300)

      const result = await resultPromise

      expect(result).toEqual({ text: 'success' })
      expect(mockDoGenerate).toHaveBeenCalledTimes(3)
    })

    it('should throw error after max retries exceeded', async () => {
      const middleware = withRetryAfter({ maxRetries: 2, baseDelay: 100 }, mockLogger)
      const rateLimitError = { status: 429, message: 'Rate limit exceeded' }
      const mockDoGenerate = jest.fn().mockRejectedValue(rateLimitError)

      const resultPromise = middleware.wrapGenerate!(createGenerateContext(mockDoGenerate))

      // Advance through all retries
      await jest.advanceTimersByTimeAsync(1000)

      await expect(resultPromise).rejects.toEqual(rateLimitError)
      expect(mockDoGenerate).toHaveBeenCalledTimes(3) // Initial + 2 retries
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Rate limit exceeded after'),
        expect.objectContaining({
          error: 'Rate limit exceeded',
        }),
      )
    })

    it('should not retry non-rate-limit errors', async () => {
      const middleware = withRetryAfter({ maxRetries: 2 }, mockLogger)
      const otherError = new Error('Some other error')
      const mockDoGenerate = jest.fn().mockRejectedValue(otherError)

      await expect(middleware.wrapGenerate!(createGenerateContext(mockDoGenerate))).rejects.toThrow('Some other error')

      expect(mockDoGenerate).toHaveBeenCalledTimes(1)
      expect(mockLogger.warn).not.toHaveBeenCalled()
    })

    it('should respect custom shouldRetry function', async () => {
      const customShouldRetry = jest.fn().mockReturnValue(false)
      const middleware = withRetryAfter({ shouldRetry: customShouldRetry }, mockLogger)
      const rateLimitError = { status: 429 }
      const mockDoGenerate = jest.fn().mockRejectedValue(rateLimitError)

      await expect(middleware.wrapGenerate!(createGenerateContext(mockDoGenerate))).rejects.toEqual(rateLimitError)

      expect(customShouldRetry).toHaveBeenCalledWith(rateLimitError)
      expect(mockDoGenerate).toHaveBeenCalledTimes(1)
    })

    it('should use custom calculateDelay function', async () => {
      const customCalculateDelay = jest.fn().mockReturnValue(500)
      const middleware = withRetryAfter({
        maxRetries: 1,
        calculateDelay: customCalculateDelay,
      }, mockLogger)
      const rateLimitError = { status: 429 }
      const mockDoGenerate = jest.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue({ text: 'success' })

      const resultPromise = middleware.wrapGenerate!(createGenerateContext(mockDoGenerate))

      await jest.advanceTimersByTimeAsync(500)

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
      const mockDoStream = jest.fn().mockResolvedValue(mockStream)

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
      const mockDoStream = jest.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue(mockStream)

      const resultPromise = middleware.wrapStream!(createStreamContext(mockDoStream))

      await jest.advanceTimersByTimeAsync(200)

      const result = await resultPromise

      expect(result).toBe(mockStream)
      expect(mockDoStream).toHaveBeenCalledTimes(2)
    })

    it('should throw error after max retries exceeded', async () => {
      const middleware = withRetryAfter({ maxRetries: 1, baseDelay: 100 }, mockLogger)
      const rateLimitError = { status: 429 }
      const mockDoStream = jest.fn().mockRejectedValue(rateLimitError)

      const resultPromise = middleware.wrapStream!(createStreamContext(mockDoStream))

      await jest.advanceTimersByTimeAsync(200)

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

      const wrappedModel = wrapWithRetryAfter(mockModel, {}, mockLogger)

      expect(wrappedModel).toBeDefined()
      expect(wrappedModel).not.toBe(mockModel)
    })

    it('should use custom options', () => {
      const mockModel = {
        provider: 'openai',
        modelId: 'gpt-4',
      } as LanguageModel

      const wrappedModel = wrapWithRetryAfter(mockModel, { maxRetries: 5 }, mockLogger)

      expect(wrappedModel).toBeDefined()
    })
  })

  describe('edge cases', () => {
    it('should handle error without status or message', async () => {
      const middleware = withRetryAfter({ maxRetries: 1 }, mockLogger)
      const error = {}
      const mockDoGenerate = jest.fn()
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
      const mockDoGenerate = jest.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue({ text: 'success' })

      const resultPromise = middleware.wrapGenerate!(createGenerateContext(mockDoGenerate))

      // Should fall back to exponential backoff
      await jest.advanceTimersByTimeAsync(200)

      const result = await resultPromise

      expect(result).toEqual({ text: 'success' })
      expect(mockDoGenerate).toHaveBeenCalledTimes(2)
    })

    it('should handle null error', async () => {
      const middleware = withRetryAfter({ maxRetries: 1 }, mockLogger)
      const mockDoGenerate = jest.fn().mockRejectedValue(null)

      await expect(middleware.wrapGenerate!(createGenerateContext(mockDoGenerate))).rejects.toBeNull()

      expect(mockDoGenerate).toHaveBeenCalledTimes(1)
    })
  })
})
