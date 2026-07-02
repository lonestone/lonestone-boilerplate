import type { EntityName } from '@mikro-orm/core'
import type { CleanedWhere } from 'better-auth/adapters'
import { MikroORM } from '@mikro-orm/core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createMikroOrmOptions } from '../db/db.config'
import { createAdapterUtils } from './auth-db.adapter'
import * as authEntities from './auth.entity'

/**
 * A minimal config that passes field names through unchanged —
 * the same config used by `diffAuthTables` in auth-db.adapter.ts (~line 368).
 */
const passthroughConfig = { getFieldName: ({ field }: { field: string }) => field }

/**
 * Helper to construct a fully-populated CleanedWhere (= Required<Where>).
 * CleanedWhere requires connector, mode, and operator to be present (not optional).
 */
function w(partial: Pick<CleanedWhere, 'field' | 'value'> & Partial<CleanedWhere>): CleanedWhere {
  return {
    connector: 'AND',
    mode: 'sensitive',
    operator: 'eq',
    ...partial,
  } as CleanedWhere
}

describe('createAdapterUtils', () => {
  let orm: MikroORM

  beforeAll(async () => {
    const entities = Object.values(authEntities) as EntityName<object>[]
    orm = await MikroORM.init(
      createMikroOrmOptions({ debug: false, entities, entitiesTs: entities }),
    )
  })

  afterAll(async () => {
    await orm?.close(true)
  })

  describe('normalizeWhereClauses', () => {
    it('returns {} for undefined where', () => {
      const utils = createAdapterUtils(orm, passthroughConfig)
      const metadata = utils.getEntityMetadata('user')
      expect(utils.normalizeWhereClauses(metadata, undefined)).toEqual({})
    })

    it('returns {} for an empty where array', () => {
      const utils = createAdapterUtils(orm, passthroughConfig)
      const metadata = utils.getEntityMetadata('user')
      expect(utils.normalizeWhereClauses(metadata, [])).toEqual({})
    })

    it('returns a flat object for a single eq clause (no $and wrapper)', () => {
      const utils = createAdapterUtils(orm, passthroughConfig)
      const metadata = utils.getEntityMetadata('user')
      const result = utils.normalizeWhereClauses(metadata, [
        w({ field: 'email', value: 'alice@example.com' }),
      ])
      expect(result).toEqual({ email: 'alice@example.com' })
    })

    it('wraps multiple AND clauses in $and (no $or key)', () => {
      const utils = createAdapterUtils(orm, passthroughConfig)
      const metadata = utils.getEntityMetadata('user')
      const result = utils.normalizeWhereClauses(metadata, [
        w({ connector: 'AND', field: 'email', value: 'alice@example.com' }),
        w({ connector: 'AND', field: 'name', value: 'Alice' }),
      ])
      expect(result).toEqual({
        $and: [{ email: 'alice@example.com' }, { name: 'Alice' }],
      })
    })

    // LOCKED BEHAVIOR: Better Auth's SQL adapters (kysely, prisma, drizzle) ALL use this same
    // partition strategy. Clauses whose connector === 'OR' go to $or; everything else
    // (no connector or connector === 'AND') goes to $and. The two groups are then AND-ed
    // together by MikroORM when the resulting FilterQuery is evaluated.
    // Verified against @better-auth/kysely-adapter dist/index.mjs lines 247-253.
    // Do NOT change this behavior — only the in-memory adapter folds left-to-right.
    it('partitions OR connector clauses into $or and AND clauses into $and', () => {
      const utils = createAdapterUtils(orm, passthroughConfig)
      const metadata = utils.getEntityMetadata('user')
      const result = utils.normalizeWhereClauses(metadata, [
        w({ connector: 'AND', field: 'email', value: 'alice@example.com' }),
        w({ connector: 'OR', field: 'email', value: 'bob@example.com' }),
      ])
      expect(result).toEqual({
        $and: [{ email: 'alice@example.com' }],
        $or: [{ email: 'bob@example.com' }],
      })
    })

    it('produces only $or when all clauses have connector OR (multi-clause)', () => {
      const utils = createAdapterUtils(orm, passthroughConfig)
      const metadata = utils.getEntityMetadata('user')
      const result = utils.normalizeWhereClauses(metadata, [
        w({ connector: 'OR', field: 'email', value: 'a@example.com' }),
        w({ connector: 'OR', field: 'email', value: 'b@example.com' }),
      ])
      // No AND clause → no $and key; only $or produced.
      expect(result).toEqual({
        $or: [{ email: 'a@example.com' }, { email: 'b@example.com' }],
      })
    })

    describe('operator mapping', () => {
      it('maps "contains" to $like with surrounding %', () => {
        const utils = createAdapterUtils(orm, passthroughConfig)
        const metadata = utils.getEntityMetadata('user')
        const result = utils.normalizeWhereClauses(metadata, [
          w({ field: 'email', operator: 'contains', value: 'example' }),
        ])
        expect(result).toEqual({ email: { $like: '%example%' } })
      })

      it('maps "starts_with" to $like with trailing %', () => {
        const utils = createAdapterUtils(orm, passthroughConfig)
        const metadata = utils.getEntityMetadata('user')
        const result = utils.normalizeWhereClauses(metadata, [
          w({ field: 'email', operator: 'starts_with', value: 'alice' }),
        ])
        expect(result).toEqual({ email: { $like: 'alice%' } })
      })

      it('maps "ends_with" to $like with leading %', () => {
        const utils = createAdapterUtils(orm, passthroughConfig)
        const metadata = utils.getEntityMetadata('user')
        const result = utils.normalizeWhereClauses(metadata, [
          w({ field: 'email', operator: 'ends_with', value: '.com' }),
        ])
        expect(result).toEqual({ email: { $like: '%.com' } })
      })

      it('maps "gt" to $gt', () => {
        const utils = createAdapterUtils(orm, passthroughConfig)
        const metadata = utils.getEntityMetadata('user')
        const result = utils.normalizeWhereClauses(metadata, [
          w({ field: 'email', operator: 'gt', value: 'a' }),
        ])
        expect(result).toEqual({ email: { $gt: 'a' } })
      })

      it('maps "gte" to $gte', () => {
        const utils = createAdapterUtils(orm, passthroughConfig)
        const metadata = utils.getEntityMetadata('user')
        const result = utils.normalizeWhereClauses(metadata, [
          w({ field: 'email', operator: 'gte', value: 'a' }),
        ])
        expect(result).toEqual({ email: { $gte: 'a' } })
      })

      it('maps "lt" to $lt', () => {
        const utils = createAdapterUtils(orm, passthroughConfig)
        const metadata = utils.getEntityMetadata('user')
        const result = utils.normalizeWhereClauses(metadata, [
          w({ field: 'email', operator: 'lt', value: 'z' }),
        ])
        expect(result).toEqual({ email: { $lt: 'z' } })
      })

      it('maps "lte" to $lte', () => {
        const utils = createAdapterUtils(orm, passthroughConfig)
        const metadata = utils.getEntityMetadata('user')
        const result = utils.normalizeWhereClauses(metadata, [
          w({ field: 'email', operator: 'lte', value: 'z' }),
        ])
        expect(result).toEqual({ email: { $lte: 'z' } })
      })

      it('maps "ne" to $ne', () => {
        const utils = createAdapterUtils(orm, passthroughConfig)
        const metadata = utils.getEntityMetadata('user')
        const result = utils.normalizeWhereClauses(metadata, [
          w({ field: 'email', operator: 'ne', value: 'bad@example.com' }),
        ])
        expect(result).toEqual({ email: { $ne: 'bad@example.com' } })
      })

      it('maps "in" to $in with an array value', () => {
        const utils = createAdapterUtils(orm, passthroughConfig)
        const metadata = utils.getEntityMetadata('user')
        const result = utils.normalizeWhereClauses(metadata, [
          w({ field: 'email', operator: 'in', value: ['a@example.com', 'b@example.com'] }),
        ])
        expect(result).toEqual({ email: { $in: ['a@example.com', 'b@example.com'] } })
      })

      it('throws when "in" receives a non-array value', () => {
        const utils = createAdapterUtils(orm, passthroughConfig)
        const metadata = utils.getEntityMetadata('user')
        expect(() =>
          utils.normalizeWhereClauses(metadata, [
            w({ field: 'email', operator: 'in', value: 'not-an-array' }),
          ]),
        ).toThrow()
      })

      it('maps "not_in" to $nin with an array value', () => {
        const utils = createAdapterUtils(orm, passthroughConfig)
        const metadata = utils.getEntityMetadata('user')
        const result = utils.normalizeWhereClauses(metadata, [
          w({ field: 'email', operator: 'not_in', value: ['bad@example.com'] }),
        ])
        expect(result).toEqual({ email: { $nin: ['bad@example.com'] } })
      })

      it('throws when "not_in" receives a non-array value', () => {
        const utils = createAdapterUtils(orm, passthroughConfig)
        const metadata = utils.getEntityMetadata('user')
        expect(() =>
          utils.normalizeWhereClauses(metadata, [
            w({ field: 'email', operator: 'not_in', value: 'not-an-array' }),
          ]),
        ).toThrow()
      })
    })
  })

  describe('normalizeSelect', () => {
    it('returns undefined when select is undefined', () => {
      const utils = createAdapterUtils(orm, passthroughConfig)
      expect(utils.normalizeSelect('user', undefined)).toBeUndefined()
    })

    it('passes field names through unchanged with the passthrough config', () => {
      const utils = createAdapterUtils(orm, passthroughConfig)
      expect(utils.normalizeSelect('user', ['email', 'name'])).toEqual(['email', 'name'])
    })

    it('applies getFieldName transformation when a custom config is used', () => {
      const prefixConfig = { getFieldName: ({ field }: { field: string }) => `prefix_${field}` }
      const utils = createAdapterUtils(orm, prefixConfig)
      expect(utils.normalizeSelect('user', ['email', 'name'])).toEqual([
        'prefix_email',
        'prefix_name',
      ])
    })
  })

  describe('getEntityMetadata', () => {
    it('resolves "user" to the User entity metadata', () => {
      const utils = createAdapterUtils(orm, passthroughConfig)
      const metadata = utils.getEntityMetadata('user')
      expect(metadata.className).toBe('User')
    })

    it('resolves "session" to the Session entity metadata', () => {
      const utils = createAdapterUtils(orm, passthroughConfig)
      const metadata = utils.getEntityMetadata('session')
      expect(metadata.className).toBe('Session')
    })

    it('throws for an unknown model name', () => {
      const utils = createAdapterUtils(orm, passthroughConfig)
      expect(() => utils.getEntityMetadata('unknownModel')).toThrow()
    })
  })

  describe('getFieldPath', () => {
    it('returns [propName] for a scalar field', () => {
      const utils = createAdapterUtils(orm, passthroughConfig)
      const metadata = utils.getEntityMetadata('user')
      expect(utils.getFieldPath(metadata, 'email')).toEqual(['email'])
    })

    it('returns [propName] for a camelCase field that maps to a column', () => {
      const utils = createAdapterUtils(orm, passthroughConfig)
      const metadata = utils.getEntityMetadata('user')
      expect(utils.getFieldPath(metadata, 'emailVerified')).toEqual(['emailVerified'])
    })

    it('returns [propName, referencedPK] for a ManyToOne relation field', () => {
      const utils = createAdapterUtils(orm, passthroughConfig)
      // Session has `user` ManyToOne relation with fieldName 'userId'
      const metadata = utils.getEntityMetadata('session')
      const path = utils.getFieldPath(metadata, 'userId')
      // ManyToOne: path is [relationPropName, referencedPK] e.g. ['user', 'id']
      expect(path).toHaveLength(2)
      expect(path[0]).toBe('user')
    })

    it('throws for a field that does not exist on the entity', () => {
      const utils = createAdapterUtils(orm, passthroughConfig)
      const metadata = utils.getEntityMetadata('user')
      expect(() => utils.getFieldPath(metadata, 'nonExistentField')).toThrow()
    })
  })
})
