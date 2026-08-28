import { describe, expect, it } from 'vitest'
import { buildOpenApiDocsUrl } from '../../packages/openapi-generator/preprocess/docs-url.js'

describe('buildOpenApiDocsUrl', () => {
  it('joins origin from the generator with prefix from the API', () => {
    const actualUrl = buildOpenApiDocsUrl('http://localhost:3000', '/api')
    const expectedUrl = 'http://localhost:3000/api/docs.json'
    expect(actualUrl).toBe(expectedUrl)
  })

  it('throws when the API prefix is missing', () => {
    expect(() => buildOpenApiDocsUrl('http://localhost:3000', undefined)).toThrow(
      'API_PREFIX is missing from apps/api/.env',
    )
  })

  it('throws when the generator origin is missing', () => {
    expect(() => buildOpenApiDocsUrl(undefined, '/api')).toThrow(
      'API_URL is missing from packages/openapi-generator/.env',
    )
  })
})
