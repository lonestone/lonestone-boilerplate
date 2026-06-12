import type { EntityName, MikroORM } from '@mikro-orm/core'
import type { AuthSchemaField, AuthSchemaModelDiff } from './auth-db.adapter'
import { relative } from 'node:path'

export interface EntityResolver {
  (model: string): { className: string, importPath: string } | undefined
}

export interface ScaffoldContext {
  resolveEntity: EntityResolver
  displayPath: (absolutePath: string) => string
}

const SCALAR_TYPES: Record<string, string> = {
  boolean: 'boolean',
  date: 'Date',
  number: 'number',
  string: 'string',
}

export function toPascalCase(name: string): string {
  return name
    .replace(/[-_\s]+(\w)/g, (_, char: string) => char.toUpperCase())
    .replace(/^\w/, char => char.toUpperCase())
}

export function toSnakeCase(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
}

export function toSourcePath(path: string): string {
  return path.replace(/([/\\])dist([/\\])/, '$1src$2').replace(/\.js$/, '.ts')
}

export function createEntityResolver(orm: MikroORM, fromDir: string): EntityResolver {
  const naming = orm.config.getNamingStrategy()
  const metadataStore = orm.getMetadata()

  return (model) => {
    const entityName = naming.getEntityName(
      naming.classToTableName(model),
    ) as unknown as EntityName<unknown>
    const metadata = metadataStore.find(entityName)

    if (!metadata?.path) {
      return undefined
    }

    let importPath = relative(fromDir, toSourcePath(metadata.path))
      .replace(/\\/g, '/')
      .replace(/\.ts$/, '')

    if (!importPath.startsWith('.')) {
      importPath = `./${importPath}`
    }

    return { className: metadata.className, importPath }
  }
}

interface RenderedProperty {
  code: string
  decorators: Set<string>
  entityImports: Map<string, string>
  typeImports: Set<string>
}

function getTypescriptType(attribute: AuthSchemaField['attribute']): string {
  const type = String(attribute.type)

  if (type === 'string[]')
    return 'string[]'
  if (type === 'number[]')
    return 'number[]'
  if (type === 'json')
    return 'Record<string, unknown>'

  return SCALAR_TYPES[type] ?? 'string'
}

function renderLiteral(value: unknown): string | undefined {
  if (typeof value === 'string')
    return `'${value}'`
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value)

  return undefined
}

function renderProperty(field: AuthSchemaField, resolveEntity: EntityResolver): RenderedProperty {
  const { attribute } = field
  const decorators = new Set<string>(['Property'])
  const entityImports = new Map<string, string>()
  const typeImports = new Set<string>()
  const lines: string[] = []

  if (attribute.references) {
    const target = resolveEntity(attribute.references.model)

    if (target) {
      decorators.delete('Property')
      decorators.add('ManyToOne')
      entityImports.set(target.className, target.importPath)
      typeImports.add('Rel')

      const propertyName = field.field.replace(/Id$/, '')
      const options: string[] = []

      if (!attribute.required)
        options.push('nullable: true')
      if (attribute.references.onDelete === 'cascade')
        options.push("deleteRule: 'cascade'")
      if (attribute.references.onDelete === 'set null')
        options.push("deleteRule: 'set null'")

      const args = options.length > 0
        ? `() => ${target.className}, { ${options.join(', ')} }`
        : `() => ${target.className}`

      lines.push(`  @ManyToOne(${args})`)
      lines.push(`  ${propertyName}${attribute.required ? '!' : '?'}: Rel<${target.className}>`)

      return { code: lines.join('\n'), decorators, entityImports, typeImports }
    }
  }

  const type = getTypescriptType(attribute)
  const options: string[] = []
  const stringType = String(attribute.type)

  if (stringType === 'json')
    options.push("type: 'json'")
  if (stringType === 'string[]' || stringType === 'number[]')
    options.push("type: 'array'")

  if (stringType === 'date' && (field.field === 'createdAt' || field.field === 'updatedAt')) {
    typeImports.add('Opt')
    const hook = field.field === 'createdAt' ? 'onCreate' : 'onUpdate'

    lines.push(`  @Property({ ${hook}: () => new Date() })`)
    lines.push(`  ${field.field}: Date & Opt = new Date()`)

    return { code: lines.join('\n'), decorators, entityImports, typeImports }
  }

  const defaultValue = renderLiteral(attribute.defaultValue)

  if (defaultValue !== undefined) {
    typeImports.add('Opt')
    options.push(`default: ${defaultValue}`)
    lines.push(`  @Property({ ${options.join(', ')} })`)

    if (attribute.unique) {
      decorators.add('Unique')
      lines.push('  @Unique()')
    }

    lines.push(`  ${field.field}: ${type} & Opt = ${defaultValue}`)

    return { code: lines.join('\n'), decorators, entityImports, typeImports }
  }

  if (!attribute.required)
    options.push('nullable: true')

  lines.push(options.length > 0 ? `  @Property({ ${options.join(', ')} })` : '  @Property()')

  if (attribute.unique) {
    decorators.add('Unique')
    lines.push('  @Unique()')
  }

  lines.push(`  ${field.field}${attribute.required ? '!' : '?'}: ${type}`)

  return { code: lines.join('\n'), decorators, entityImports, typeImports }
}

const SCAFFOLD_HEADER = `// Generated by the better-auth CLI (\`pnpm auth:generate\`) - MikroORM adapter.
//
// This scaffold is a starting point, not meant to be committed as-is:
//   1. Move each entity class below into the auth entity structure used by this project.
//   2. Register new entity classes in the MikroORM config if entity discovery is explicit.
//   3. Apply the commented property blocks to the existing entities shown by path.
//   4. Delete this file, run \`pnpm db:migrate:create\`, and run the tests.`

export function renderScaffold(diffs: AuthSchemaModelDiff[], context: ScaffoldContext): string {
  const decorators = new Set<string>()
  const entityImports = new Map<string, string>()
  const typeImports = new Set<string>()
  const classes: string[] = []
  const patches: string[] = []

  for (const diff of diffs) {
    if (diff.metadata) {
      const blocks = diff.missingFields
        .map(field => renderProperty(field, context.resolveEntity).code)
        .join('\n\n')
        .split('\n')
        .map(line => (line.length > 0 ? `// ${line}` : '//'))
        .join('\n')

      patches.push([
        '// ---------------------------------------------------------------------------',
        `// Add to ${diff.metadata.className} (${context.displayPath(toSourcePath(diff.metadata.path))}):`,
        '//',
        blocks,
        '// ---------------------------------------------------------------------------',
      ].join('\n'))
      continue
    }

    const className = toPascalCase(diff.model)
    const properties = diff.fields.map(field => renderProperty(field, context.resolveEntity))

    decorators.add('Entity')
    decorators.add('PrimaryKey')

    for (const property of properties) {
      for (const decorator of property.decorators) decorators.add(decorator)
      for (const [name, path] of property.entityImports) entityImports.set(name, path)
      for (const typeImport of property.typeImports) typeImports.add(typeImport)
    }

    classes.push([
      `@Entity({ tableName: '${toSnakeCase(diff.model)}' })`,
      `export class ${className} {`,
      `  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })`,
      '  id!: string',
      '',
      properties.map(property => property.code).join('\n\n'),
      '}',
    ].join('\n'))
  }

  const header: string[] = [SCAFFOLD_HEADER, '']

  if (classes.length > 0) {
    if (typeImports.size > 0) {
      header.push(`import type { ${[...typeImports].toSorted().join(', ')} } from '@mikro-orm/core'`, '')
    }

    header.push(`import { ${[...decorators].toSorted().join(', ')} } from '@mikro-orm/decorators/legacy'`)

    if (entityImports.size > 0) {
      header.push('')
      for (const [name, path] of [...entityImports.entries()].toSorted()) {
        header.push(`import { ${name} } from '${path}'`)
      }
    }

    header.push('')
  }

  const content = [
    ...header,
    ...classes,
    ...(classes.length > 0 && patches.length > 0 ? [''] : []),
    ...patches,
  ]

  return `${content.join('\n')}\n`
}
