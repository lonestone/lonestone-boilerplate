import { z } from 'zod'

function parseJsonValue(value: unknown): unknown {
  if (typeof value !== 'string') return value

  try {
    const parsed: unknown = JSON.parse(value)
    return typeof parsed === 'object' && parsed !== null ? parsed : value
  } catch {
    return value
  }
}

/**
 * Reads an array from a multipart field. The generated SDK sends one field per item and each
 * object item as JSON; a single JSON array is accepted too. The controller gets a typed array,
 * and OpenAPI documents an array, so the SDK takes an array as well.
 *
 * @example
 * tags: multipartArray(z.string()).optional()
 */
export function multipartArray<T extends z.ZodType>(item: T) {
  return z.preprocess(
    (value) => (value === undefined ? undefined : [value].flat().flatMap(parseJsonValue)),
    z.array(item),
  )
}
