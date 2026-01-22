import type { LanguageModel, LanguageModelMiddleware } from 'ai'
import { Logger } from '@nestjs/common'
import { wrapLanguageModel } from 'ai'

interface RateLimitErrorHeaders {
  get?: (key: string) => string | null
  [key: string]: string | undefined | ((key: string) => string | null)
}

interface RateLimitErrorResponse {
  headers?: RateLimitErrorHeaders
}

interface RateLimitError {
  status?: number
  message?: string
  code?: string
  response?: RateLimitErrorResponse
  headers?: RateLimitErrorHeaders
}

type RetryableError = RateLimitError | Error | unknown

export interface WithRetryAfterOptions {
  maxRetries?: number
  baseDelay?: number
  maxDelay?: number
  exponentialBackoff?: boolean
  shouldRetry?: (error: RetryableError) => boolean
  calculateDelay?: (retryCount: number, retryAfter?: string) => number
}

const DEFAULT_OPTIONS: Required<Omit<WithRetryAfterOptions, 'shouldRetry' | 'calculateDelay'>> & {
  shouldRetry: (error: RetryableError) => boolean
  calculateDelay: (retryCount: number, retryAfter?: string, baseDelay?: number, maxDelay?: number) => number
} = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 60000,
  exponentialBackoff: true,
  shouldRetry: (error: RetryableError) => {
    if (error && typeof error === 'object') {
      const err = error as RateLimitError
      return err.status === 429
        || (typeof err.message === 'string' && (err.message.includes('rate limit') || err.message.includes('429')))
        || err.code === 'rate_limit_exceeded'
    }
    return false
  },
  calculateDelay: (retryCount: number, retryAfter?: string, baseDelay = 1000, maxDelay = 60000) => {
    if (retryAfter) {
      const retryAfterSeconds = Number.parseInt(retryAfter, 10)
      if (!Number.isNaN(retryAfterSeconds)) {
        return retryAfterSeconds * 1000
      }
    }

    const delay = Math.min(
      baseDelay * 2 ** retryCount,
      maxDelay,
    )

    const jitter = Math.random() * 0.1 * delay
    return delay + jitter
  },
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function extractRetryAfter(error: RetryableError): string | undefined {
  if (!error || typeof error !== 'object') {
    return undefined
  }

  const err = error as RateLimitError

  const getHeaderValue = (headers: RateLimitErrorHeaders, key: string): string | undefined => {
    if (typeof headers.get === 'function') {
      const value = headers.get(key)
      if (value) {
        return value
      }
    }
    const lowerKey = key.toLowerCase()
    const value = headers[lowerKey] || headers[key]
    if (typeof value === 'string') {
      return value
    }
    return undefined
  }

  const headers = err.response?.headers || err.headers

  if (!headers) {
    return undefined
  }

  const retryAfter = getHeaderValue(headers, 'retry-after')
    || getHeaderValue(headers, 'Retry-After')
    || getHeaderValue(headers, 'retry-after-ms')
    || getHeaderValue(headers, 'Retry-After-Ms')
    || undefined

  return retryAfter
}

export function withRetryAfter(
  options: WithRetryAfterOptions = {},
  logger?: Logger,
): LanguageModelMiddleware {
  const baseDelay = options.baseDelay ?? DEFAULT_OPTIONS.baseDelay
  const maxDelay = options.maxDelay ?? DEFAULT_OPTIONS.maxDelay

  const opts = {
    ...DEFAULT_OPTIONS,
    ...options,
    baseDelay,
    maxDelay,
    calculateDelay: options.calculateDelay || ((retryCount, retryAfter) =>
      DEFAULT_OPTIONS.calculateDelay(retryCount, retryAfter, baseDelay, maxDelay)),
  }

  const log = logger || new Logger('AiRateLimitMiddleware')

  return {
    specificationVersion: 'v3',

    wrapGenerate: async ({ doGenerate }) => {
      let lastError: RetryableError
      let retryCount = 0

      while (retryCount <= opts.maxRetries) {
        try {
          return await doGenerate()
        }
        catch (error) {
          lastError = error

          if (!opts.shouldRetry(error)) {
            throw error
          }

          if (retryCount >= opts.maxRetries) {
            log.warn(`Rate limit exceeded after ${opts.maxRetries + 1} attempts`, {
              error: error instanceof Error ? error.message : 'Unknown error',
            })
            throw error
          }

          const retryAfter = extractRetryAfter(error)
          const delay = opts.calculateDelay(retryCount, retryAfter)

          log.warn(`Rate limit hit, retrying in ${Math.round(delay)}ms (attempt ${retryCount + 1}/${opts.maxRetries + 1})`, {
            retryAfter,
            retryCount: retryCount + 1,
            maxRetries: opts.maxRetries,
          })

          await sleep(delay)
          retryCount++
        }
      }

      throw lastError
    },

    wrapStream: async ({ doStream }) => {
      let lastError: RetryableError
      let retryCount = 0

      while (retryCount <= opts.maxRetries) {
        try {
          return await doStream()
        }
        catch (error) {
          lastError = error

          if (!opts.shouldRetry(error)) {
            throw error
          }

          if (retryCount >= opts.maxRetries) {
            log.warn(`Rate limit exceeded after ${opts.maxRetries + 1} attempts`, {
              error: error instanceof Error ? error.message : 'Unknown error',
            })
            throw error
          }

          const retryAfter = extractRetryAfter(error)
          const delay = opts.calculateDelay(retryCount, retryAfter)

          log.warn(`Rate limit hit, retrying in ${Math.round(delay)}ms (attempt ${retryCount + 1}/${opts.maxRetries + 1})`, {
            retryAfter,
            retryCount: retryCount + 1,
            maxRetries: opts.maxRetries,
          })

          await sleep(delay)
          retryCount++
        }
      }

      throw lastError
    },
  }
}

export function wrapWithRetryAfter(
  model: LanguageModel,
  options?: WithRetryAfterOptions,
  logger?: Logger,
): LanguageModel {
  return wrapLanguageModel({
    model: model as Parameters<typeof wrapLanguageModel>[0]['model'],
    middleware: withRetryAfter(options, logger),
  }) as LanguageModel
}
