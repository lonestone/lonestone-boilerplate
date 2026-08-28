import { describe, expect, it } from 'vitest'
import { normalizeApiPrefix } from '../../cli/utils'
import { buildOpenApiDocsUrl } from '../../packages/openapi-generator/preprocess/docs-url.js'

describe('normalizeApiPrefix', () => {
  it('defaults empty values to /api', () => {
    expect(normalizeApiPrefix(undefined)).toBe('/api')
    expect(normalizeApiPrefix('')).toBe('/api')
    expect(normalizeApiPrefix(' / ')).toBe('/api')
  })

  it('adds a leading slash and strips trailing slashes', () => {
    expect(normalizeApiPrefix('api')).toBe('/api')
    expect(normalizeApiPrefix('/api/')).toBe('/api')
    expect(normalizeApiPrefix(' /v1/ ')).toBe('/v1')
  })
})

describe('buildOpenApiDocsUrl', () => {
  it('joins origin and prefix at fetch time', () => {
    const actualUrl = buildOpenApiDocsUrl('http://localhost:3000', '/api')
    const expectedUrl = 'http://localhost:3000/api/docs.json'
    expect(actualUrl).toBe(expectedUrl)
  })

  it('does not bake the prefix into the origin', () => {
    const actualUrl = buildOpenApiDocsUrl('http://localhost:4000/', 'v1/')
    const expectedUrl = 'http://localhost:4000/v1/docs.json'
    expect(actualUrl).toBe(expectedUrl)
  })
})
