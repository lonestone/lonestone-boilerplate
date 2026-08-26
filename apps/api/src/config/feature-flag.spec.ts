import { afterEach, describe, expect, it } from 'vitest'
import { isFeatureEnabled } from './feature-flag'

describe('isFeatureEnabled', () => {
  afterEach(() => {
    delete process.env.FEATURE_BILLING
  })

  it('returns true for true and 1, ignoring case', () => {
    process.env.FEATURE_BILLING = 'true'
    expect(isFeatureEnabled('billing')).toBe(true)

    process.env.FEATURE_BILLING = 'TRUE'
    expect(isFeatureEnabled('billing')).toBe(true)

    process.env.FEATURE_BILLING = '1'
    expect(isFeatureEnabled('billing')).toBe(true)
  })

  it('accepts the FEATURE_ prefix on the flag name', () => {
    process.env.FEATURE_BILLING = 'true'
    expect(isFeatureEnabled('FEATURE_BILLING')).toBe(true)
  })

  it('returns false when unset or set to any other value', () => {
    delete process.env.FEATURE_BILLING
    expect(isFeatureEnabled('billing')).toBe(false)

    process.env.FEATURE_BILLING = 'false'
    expect(isFeatureEnabled('billing')).toBe(false)

    process.env.FEATURE_BILLING = 'yes'
    expect(isFeatureEnabled('billing')).toBe(false)
  })
})
