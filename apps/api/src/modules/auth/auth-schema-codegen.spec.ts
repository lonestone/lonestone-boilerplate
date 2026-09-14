import type { AuthSchemaField } from './auth-db.adapter'
import { describe, expect, it } from 'vitest'
import { renderProperty } from './auth-schema-codegen'

const unusedResolveEntity = () => undefined

describe('renderProperty', () => {
  it('maps a required Better Auth string field to PostgreSQL text', () => {
    const inputField: AuthSchemaField = {
      field: 'privateKey',
      attribute: { type: 'string', required: true },
    }

    const actualProperty = renderProperty(inputField, unusedResolveEntity)

    expect(actualProperty.code).toContain("@Property({ type: 'text' })")
    expect(actualProperty.code).toContain('privateKey!: string')
  })

  it('maps an optional Better Auth string field to nullable text', () => {
    const inputField: AuthSchemaField = {
      field: 'image',
      attribute: { type: 'string', required: false },
    }

    const actualProperty = renderProperty(inputField, unusedResolveEntity)

    expect(actualProperty.code).toContain("@Property({ type: 'text', nullable: true })")
  })

  it('keeps type text when a string field has a default value', () => {
    const inputField: AuthSchemaField = {
      field: 'role',
      attribute: { type: 'string', required: true, defaultValue: 'member' },
    }

    const actualProperty = renderProperty(inputField, unusedResolveEntity)

    expect(actualProperty.code).toContain("type: 'text'")
  })
})
