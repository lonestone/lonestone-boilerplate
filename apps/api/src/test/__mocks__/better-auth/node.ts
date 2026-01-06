/**
 * Mock for better-auth/node module
 * Used in Jest tests to avoid ESM import issues
 */

type HeadersInput = Record<string, string> | [string, string][]

export function fromNodeHeaders(headers: HeadersInput) {
  return new Headers(headers)
}

export function toNodeHandler<TArgs extends unknown[], TReturn>(handler: (...args: TArgs) => TReturn) {
  return handler
}
