import type {
  EntityData,
  EntityMetadata,
  EntityName,
  EntityProperty,
  FilterQuery,
  FindOptions,
  MikroORM,
} from '@mikro-orm/core'
import type { BetterAuthOptions } from 'better-auth'
import type { CleanedWhere, DBAdapterDebugLogOption } from 'better-auth/adapters'
import type { DBFieldAttribute } from 'better-auth/db'
import { writeFileSync } from 'node:fs'
import { ReferenceKind, serialize } from '@mikro-orm/core'
import { EnsureRequestContext } from '@mikro-orm/decorators/legacy'
import { BetterAuthError } from 'better-auth'
import { createAdapterFactory } from 'better-auth/adapters'
import { getAuthTables } from 'better-auth/db'
import { applyEntityPatches } from './auth-schema-codegen'

export interface MikroOrmAdapterConfig {
  debugLogs?: DBAdapterDebugLogOption
  supportsJSON?: boolean
}

type AdapterFactoryCreatorConfig = Parameters<
  Parameters<typeof createAdapterFactory>[0]['adapter']
>[0]

type AdapterPrimitive = string | number | boolean | Date | null | undefined
interface AuthModelEntity {}
interface PathRecord {
  [key: PathKey]: AdapterValue
}

type AdapterValue = AdapterPrimitive | AdapterValue[] | AuthModelEntity | PathRecord
type AuthEntityMetadata = EntityMetadata<AuthModelEntity>
type AuthEntityProperty = EntityProperty<AuthModelEntity>
type AuthEntityData = EntityData<AuthModelEntity>
type AuthFilterQuery = FilterQuery<AuthModelEntity>
type AuthFindOptions = FindOptions<AuthModelEntity>
type PathKey = string | number
type AuthRecord = Record<string, AdapterValue>

interface AdapterCreateParams<T> {
  data: T
  model: string
  select?: string[]
}

interface AdapterQueryParams {
  model: string
  where?: CleanedWhere[]
}

interface AdapterFindOneParams extends AdapterQueryParams {
  select?: string[]
}

interface AdapterFindManyParams extends AdapterFindOneParams {
  limit?: number
  offset?: number
  sortBy?: {
    direction: 'asc' | 'desc'
    field: string
  }
}

interface AdapterUpdateParams<T> extends AdapterQueryParams {
  update: T
}

function isPathRecord(value: AdapterValue): value is PathRecord {
  return (
    typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)
  )
}

function toAuthRecord<T>(value: T): AuthRecord {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as AuthRecord
  }

  throwAdapterError('Expected adapter input to be an object record.')
}

function setPath(obj: PathRecord, path: readonly PathKey[], value: AdapterValue): void {
  if (path.length === 0) {
    throwAdapterError('Cannot set an empty object path.')
  }

  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i]!
    const next = obj[key]

    if (isPathRecord(next)) {
      obj = next
      continue
    }

    const child: PathRecord = {}
    obj[key] = child
    obj = child
  }

  obj[path[path.length - 1]!] = value
}

function throwAdapterError(message: string): never {
  throw new BetterAuthError(`[MikroORM Adapter] ${message}`)
}

const OWN_REFERENCES: ReadonlySet<ReferenceKind> = new Set([
  ReferenceKind.SCALAR,
  ReferenceKind.ONE_TO_MANY,
  ReferenceKind.EMBEDDED,
])

interface AdapterUtils {
  getEntityMetadata: (name: string) => AuthEntityMetadata
  getFieldPath: (
    metadata: AuthEntityMetadata,
    fieldName: string,
    throwOnShadowProps?: boolean,
  ) => string[]
  normalizeInput: (metadata: AuthEntityMetadata, input: AuthRecord) => AuthEntityData
  normalizeOutput: (
    metadata: AuthEntityMetadata,
    output: AuthModelEntity,
    select?: string[],
  ) => AuthRecord
  normalizeSelect: (model: string, input?: string[]) => string[] | undefined
  normalizeWhereClauses: (metadata: AuthEntityMetadata, where?: CleanedWhere[]) => AuthFilterQuery
}

export function createAdapterUtils(
  orm: MikroORM,
  config: Pick<AdapterFactoryCreatorConfig, 'getFieldName'>,
): AdapterUtils {
  const naming = orm.config.getNamingStrategy()
  const metadataStore = orm.getMetadata()

  const normalizeEntityName = (name: string): string =>
    naming.getEntityName(naming.classToTableName(name))

  const getEntityMetadata: AdapterUtils['getEntityMetadata'] = (entityName) => {
    const normalized = normalizeEntityName(entityName)
    const metadata = [...metadataStore.getAll().values()].find(
      (meta) => meta.className === normalized,
    )

    if (!metadata) {
      throwAdapterError(
        `Cannot find metadata for "${normalized}" entity. Make sure it is defined and listed in your MikroORM config.`,
      )
    }

    return metadata as AuthEntityMetadata
  }

  function getPropertyMetadata(
    metadata: AuthEntityMetadata,
    fieldName: string,
  ): AuthEntityProperty {
    const columnName = naming.propertyToColumnName(fieldName)

    const prop = metadata.props.find((property) => {
      if (OWN_REFERENCES.has(property.kind) && property.name === fieldName) {
        return true
      }

      if (property.kind !== ReferenceKind.MANY_TO_ONE) {
        return false
      }

      return (
        property.name === fieldName ||
        property.fieldNames.includes(fieldName) ||
        property.fieldNames.includes(columnName) ||
        property.fieldNames.some((field) => naming.columnNameToProperty(field) === fieldName)
      )
    })

    if (!prop) {
      throwAdapterError(`Cannot find property "${fieldName}" on entity "${metadata.className}".`)
    }

    return prop
  }

  function getReferencedColumnName(prop: AuthEntityProperty): string {
    if (OWN_REFERENCES.has(prop.kind)) {
      return prop.name
    }

    if (prop.kind === ReferenceKind.MANY_TO_ONE) {
      const fieldName = prop.fieldNames[0]

      return fieldName
        ? naming.columnNameToProperty(fieldName)
        : naming.columnNameToProperty(naming.joinColumnName(prop.name))
    }

    throwAdapterError(`Reference kind ${prop.kind} is not supported for field "${prop.name}".`)
  }

  const getFieldPath: AdapterUtils['getFieldPath'] = (
    metadata,
    fieldName,
    throwOnShadowProps = false,
  ) => {
    const prop = getPropertyMetadata(metadata, fieldName)

    if (prop.persist === false && throwOnShadowProps) {
      throwAdapterError(
        `Cannot serialize "${fieldName}" into a path because it is not persisted in table "${metadata.tableName}".`,
      )
    }

    if (prop.kind === ReferenceKind.SCALAR || prop.kind === ReferenceKind.EMBEDDED) {
      return [prop.name]
    }

    if (prop.kind === ReferenceKind.MANY_TO_ONE) {
      if (prop.referencedPKs.length > 1) {
        throwAdapterError(
          `Field "${fieldName}" references a table with a composite primary key, which is not supported.`,
        )
      }

      return [prop.name, naming.referenceColumnName()]
    }

    throwAdapterError(
      `Cannot normalize field "${fieldName}" into a path for entity "${metadata.className}".`,
    )
  }

  const normalizeInput: AdapterUtils['normalizeInput'] = (metadata, input) => {
    const fields: PathRecord = {}

    for (const [key, value] of Object.entries(input)) {
      const prop = getPropertyMetadata(metadata, key)
      const normalizedValue =
        prop.targetMeta && !OWN_REFERENCES.has(prop.kind)
          ? orm.em.getReference(prop.targetMeta.class as EntityName<AuthModelEntity>, value)
          : value

      setPath(fields, [prop.name], normalizedValue)
    }

    return fields as AuthEntityData
  }

  const normalizeOutput: AdapterUtils['normalizeOutput'] = (metadata, output, select) => {
    let result: AuthRecord = {}
    const raw = serialize(output) as AuthRecord

    for (const [key, value] of Object.entries(raw)) {
      const prop = getPropertyMetadata(metadata, key)
      setPath(result, [getReferencedColumnName(prop)], value)
    }

    if (select) {
      result = Object.fromEntries(Object.entries(result).filter(([name]) => select.includes(name)))
    }

    return result
  }

  function normalizeWhereClause(
    path: readonly PathKey[],
    input: CleanedWhere,
    target: PathRecord = {},
  ): AuthFilterQuery {
    switch (input.operator) {
      case 'contains':
        setPath(target, [...path, '$like'], `%${input.value}%`)
        break
      case 'ends_with':
        setPath(target, [...path, '$like'], `%${input.value}`)
        break
      case 'gt':
      case 'gte':
      case 'lt':
      case 'lte':
      case 'ne':
        setPath(target, [...path, `$${input.operator}`], input.value)
        break
      case 'in':
        if (!Array.isArray(input.value)) {
          throwAdapterError(
            `The value for "${input.field}" must be an array when using the "in" operator.`,
          )
        }
        setPath(target, [...path, '$in'], input.value)
        break
      case 'not_in':
        if (!Array.isArray(input.value)) {
          throwAdapterError(
            `The value for "${input.field}" must be an array when using the "not_in" operator.`,
          )
        }
        setPath(target, [...path, '$nin'], input.value)
        break
      case 'starts_with':
        setPath(target, [...path, '$like'], `${input.value}%`)
        break
      case 'eq':
      default:
        setPath(target, path, input.value)
        break
    }

    return target as AuthFilterQuery
  }

  const normalizeWhereClauses: AdapterUtils['normalizeWhereClauses'] = (metadata, where) => {
    if (!where || where.length === 0) {
      return {}
    }

    if (where.length === 1) {
      const clause = where[0]!
      return normalizeWhereClause(getFieldPath(metadata, clause.field, true), clause)
    }

    const result: AuthRecord = {}
    const andClauses = where.filter((clause) => !clause.connector || clause.connector === 'AND')
    const orClauses = where.filter((clause) => clause.connector === 'OR')

    if (andClauses.length > 0) {
      result.$and = andClauses.map((clause) =>
        normalizeWhereClause(getFieldPath(metadata, clause.field, true), clause),
      )
    }

    if (orClauses.length > 0) {
      result.$or = orClauses.map((clause) =>
        normalizeWhereClause(getFieldPath(metadata, clause.field, true), clause),
      )
    }

    return result as AuthFilterQuery
  }

  const normalizeSelect: AdapterUtils['normalizeSelect'] = (model, select) =>
    select?.map((field) => config.getFieldName({ field, model }))

  return {
    getEntityMetadata,
    getFieldPath,
    normalizeInput,
    normalizeOutput,
    normalizeSelect,
    normalizeWhereClauses,
  }
}

export interface AuthSchemaField {
  attribute: DBFieldAttribute
  field: string
}

export interface AuthSchemaModelDiff {
  fields: AuthSchemaField[]
  metadata?: AuthEntityMetadata
  missingFields: AuthSchemaField[]
  model: string
  problems: string[]
}

export function diffAuthTables(
  orm: MikroORM,
  tables: ReturnType<typeof getAuthTables>,
): AuthSchemaModelDiff[] {
  const utils = createAdapterUtils(orm, { getFieldName: ({ field }) => field })
  const diffs: AuthSchemaModelDiff[] = []
  for (const table of Object.values(tables)) {
    const fields: AuthSchemaField[] = Object.entries(table.fields).map(([key, attribute]) => ({
      attribute,
      field: attribute.fieldName ?? key,
    }))

    let metadata: AuthEntityMetadata

    try {
      metadata = utils.getEntityMetadata(table.modelName)
    } catch {
      diffs.push({
        fields,
        missingFields: fields,
        model: table.modelName,
        problems: [`Cannot find metadata for "${table.modelName}" entity.`],
      })
      continue
    }

    const missingFields: AuthSchemaField[] = []
    const problems: string[] = []

    for (const field of fields) {
      try {
        utils.getFieldPath(metadata, field.field)
      } catch {
        missingFields.push(field)
        problems.push(`Cannot find property "${field.field}" on entity "${metadata.className}".`)
      }
    }

    if (missingFields.length > 0) {
      diffs.push({ fields, metadata, missingFields, model: table.modelName, problems })
    }
  }

  return diffs
}

export function diffAuthSchema(orm: MikroORM, options: BetterAuthOptions): AuthSchemaModelDiff[] {
  return diffAuthTables(orm, getAuthTables(options))
}

export function validateAuthSchema(orm: MikroORM, options: BetterAuthOptions): string[] {
  return diffAuthSchema(orm, options).flatMap((diff) => diff.problems)
}

// Better Auth is not only called from HTTP handlers. A WebSocket gateway, a
// scheduled task or a queue worker has no ambient MikroORM context, so
// `orm.em` stays the global instance and MikroORM refuses context-specific
// work. Every operation that touches the database is wrapped in
// `@EnsureRequestContext`, which reuses the request fork when there is one,
// joins the surrounding transaction when there is one, and opens a context for
// the operation otherwise. `orm.em` then resolves to the same fork for the
// whole method, so persist and flush stay on the same instance. The methods
// live on a class because the decorator only applies to class members.
class MikroOrmAuthAdapter {
  private readonly utils: AdapterUtils

  constructor(
    private readonly orm: MikroORM,
    config: Pick<AdapterFactoryCreatorConfig, 'getFieldName'>,
  ) {
    this.utils = createAdapterUtils(orm, config)
  }

  @EnsureRequestContext()
  async count({ model, where }: AdapterQueryParams): Promise<number> {
    const { em } = this.orm
    const metadata = this.utils.getEntityMetadata(model)

    return em.count(metadata.class, this.utils.normalizeWhereClauses(metadata, where))
  }

  @EnsureRequestContext()
  async create<T>({ data, model, select }: AdapterCreateParams<T>): Promise<T> {
    const { em } = this.orm
    const metadata = this.utils.getEntityMetadata(model)
    const input = this.utils.normalizeInput(metadata, toAuthRecord(data))
    const entity = em.create(metadata.class, input, { partial: true })

    em.persist(entity)
    await em.flush()

    const normalizedSelect = this.utils.normalizeSelect(model, select)

    return this.utils.normalizeOutput(metadata, entity, normalizedSelect) as T
  }

  async createSchema({
    file,
    tables,
  }: {
    file?: string
    tables: ReturnType<typeof getAuthTables>
  }) {
    const defaultPath = file ?? 'src/modules/auth/auth.entity.ts'
    const diffs = diffAuthTables(this.orm, tables)

    if (diffs.length === 0) {
      return { code: '', path: defaultPath }
    }

    const patchedFiles = applyEntityPatches(diffs, this.orm, defaultPath)

    if (patchedFiles.size > 0) {
      const entries = [...patchedFiles.entries()].toSorted(([left], [right]) =>
        left.localeCompare(right),
      )
      const [schemaPath, schemaContent] = entries.at(-1)!

      for (const [path, content] of entries.slice(0, -1)) {
        writeFileSync(path, content)
      }

      return { code: schemaContent, path: schemaPath, overwrite: true }
    }

    throwAdapterError(
      `Cannot determine which MikroORM entity file should receive Better Auth schema changes. Check createMikroOrmOptions() entities discovery.`,
    )
  }

  @EnsureRequestContext()
  async delete({ model, where }: AdapterQueryParams): Promise<void> {
    const { em } = this.orm
    const metadata = this.utils.getEntityMetadata(model)
    const entity = await em.findOne(
      metadata.class,
      this.utils.normalizeWhereClauses(metadata, where),
    )

    if (!entity) {
      return
    }

    em.remove(entity)
    await em.flush()
  }

  @EnsureRequestContext()
  async deleteMany({ model, where }: AdapterQueryParams): Promise<number> {
    const { em } = this.orm
    const metadata = this.utils.getEntityMetadata(model)

    return em.nativeDelete(metadata.class, this.utils.normalizeWhereClauses(metadata, where))
  }

  @EnsureRequestContext()
  async findMany<T>({
    limit,
    model,
    offset,
    select,
    sortBy,
    where,
  }: AdapterFindManyParams): Promise<T[]> {
    const { em } = this.orm
    const metadata = this.utils.getEntityMetadata(model)
    const options: PathRecord = {}

    if (limit !== undefined) options.limit = limit
    if (offset !== undefined) options.offset = offset

    if (sortBy) {
      const path = this.utils.getFieldPath(metadata, sortBy.field)
      setPath(options, ['orderBy', ...path], sortBy.direction)
    }

    const rows = await em.find(
      metadata.class,
      this.utils.normalizeWhereClauses(metadata, where),
      options as AuthFindOptions,
    )
    const normalizedSelect = this.utils.normalizeSelect(model, select)

    return rows.map((row) => this.utils.normalizeOutput(metadata, row, normalizedSelect)) as T[]
  }

  @EnsureRequestContext()
  async findOne<T>({ model, select, where }: AdapterFindOneParams): Promise<T | null> {
    const { em } = this.orm
    const metadata = this.utils.getEntityMetadata(model)
    const entity = await em.findOne(
      metadata.class,
      this.utils.normalizeWhereClauses(metadata, where),
    )

    if (!entity) {
      return null
    }

    const normalizedSelect = this.utils.normalizeSelect(model, select)

    return this.utils.normalizeOutput(metadata, entity, normalizedSelect) as T
  }

  @EnsureRequestContext()
  async update<T>({ model, update, where }: AdapterUpdateParams<T>): Promise<T | null> {
    const { em } = this.orm
    const metadata = this.utils.getEntityMetadata(model)
    const entity = await em.findOne(
      metadata.class,
      this.utils.normalizeWhereClauses(metadata, where),
    )

    if (!entity) {
      return null
    }

    em.assign(entity, this.utils.normalizeInput(metadata, toAuthRecord(update)))
    await em.flush()

    return this.utils.normalizeOutput(metadata, entity) as T
  }

  @EnsureRequestContext()
  async updateMany<T>({ model, update, where }: AdapterUpdateParams<T>): Promise<number> {
    const { em } = this.orm
    const metadata = this.utils.getEntityMetadata(model)

    return em.nativeUpdate(
      metadata.class,
      this.utils.normalizeWhereClauses(metadata, where),
      this.utils.normalizeInput(metadata, toAuthRecord(update)),
    )
  }
}

export function mikroOrmAdapter(
  orm: MikroORM,
  { debugLogs, supportsJSON = true }: MikroOrmAdapterConfig = {},
) {
  return createAdapterFactory({
    adapter: (config) => new MikroOrmAuthAdapter(orm, config),
    config: {
      adapterId: 'mikro-orm-adapter',
      adapterName: 'MikroORM Adapter',
      debugLogs,
      supportsJSON,
    },
  })
}
