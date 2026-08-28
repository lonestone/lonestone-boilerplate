import { describe, expect, it } from 'vitest'
import { buildOpenApiGeneratorApiUrl, normalizeApiPrefix } from '../../cli/utils'

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

describe('buildOpenApiGeneratorApiUrl', () => {
  it('joins the API origin with the Nest prefix', () => {
    const actualUrl = buildOpenApiGeneratorApiUrl(3000, '/api')
    const expectedUrl = 'http://localhost:3000/api'
    expect(actualUrl).toBe(expectedUrl)
  })

  it('normalizes a custom prefix before joining', () => {
    const actualUrl = buildOpenApiGeneratorApiUrl(4000, 'v1/')
    const expectedUrl = 'http://localhost:4000/v1'
    expect(actualUrl).toBe(expectedUrl)
  })
})
