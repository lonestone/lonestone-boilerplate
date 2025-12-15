/**
 * Mock for better-auth/node module
 * Used in Jest tests to avoid ESM import issues
 */

export function fromNodeHeaders(headers: any) {
  return new Headers(headers)
}

export function toNodeHandler(handler: any) {
  return handler
}
