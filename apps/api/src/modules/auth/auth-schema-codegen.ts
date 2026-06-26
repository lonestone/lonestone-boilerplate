import type { MikroORM } from '@mikro-orm/core'
import type { AuthSchemaField, AuthSchemaModelDiff } from './auth-db.adapter'
import { readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'

const DEFAULT_FALLBACK_ENTITY_FILE = 'src/modules/auth/auth.entity.ts'

export interface EntityResolver {
  (model: string): { className: string, importPath: string } | undefined
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

export function toKebabCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[-_\s]+/g, '-')
    .toLowerCase()
}

export function toSourcePath(path: string): string {
  return path.replace(/([/\\])dist([/\\])/, '$1src$2').replace(/\.js$/, '.ts')
}

type GeneratedEntityFiles = Map<string, string>

function toImportPath(fromDir: string, filePath: string): string {
  let importPath = relative(fromDir, toSourcePath(filePath))
    .replace(/\\/g, '/')
    .replace(/\.ts$/, '')

  if (!importPath.startsWith('.')) {
    importPath = `./${importPath}`
  }

  return importPath
}

export function createEntityResolver(
  orm: MikroORM,
  fromDir: string,
  generatedEntities: GeneratedEntityFiles = new Map(),
): EntityResolver {
  const naming = orm.config.getNamingStrategy()
  const metadataStore = orm.getMetadata()

  return (model) => {
    const generatedEntityFile = generatedEntities.get(model)
    if (generatedEntityFile) {
      return {
        className: toPascalCase(model),
        importPath: toImportPath(fromDir, generatedEntityFile),
      }
    }

    const entityName = naming.getEntityName(
      naming.classToTableName(model),
    )
    const metadata = [...metadataStore.getAll().values()].find(meta => meta.className === entityName)

    if (!metadata?.path) {
      return undefined
    }

    return { className: metadata.className, importPath: toImportPath(fromDir, metadata.path) }
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
    return 'object'

  return SCALAR_TYPES[type] ?? 'string'
}

function renderLiteral(value: AuthSchemaField['attribute']['defaultValue']): string | undefined {
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
      const options: string[] = [`fieldName: '${field.field}'`]

      if (!attribute.required)
        options.push('nullable: true')
      if (attribute.references.onDelete === 'cascade')
        options.push('deleteRule: \'cascade\'')
      if (attribute.references.onDelete === 'set null')
        options.push('deleteRule: \'set null\'')

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

  // Scalar columns mirror the property name verbatim under
  // EntityCaseNamingStrategy, so no explicit `fieldName` is needed.
  if (stringType === 'json')
    options.push('type: \'json\'')
  if (stringType === 'string[]' || stringType === 'number[]')
    options.push('type: \'array\'')

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

function renderMissingEntity(
  diff: AuthSchemaModelDiff,
  orm: MikroORM,
  filePath: string,
  generatedEntities: GeneratedEntityFiles,
): RenderedEntity {
  const resolveEntity = createEntityResolver(orm, resolve(filePath, '..'), generatedEntities)
  const className = toPascalCase(diff.model)
  const properties = diff.fields.map(field => renderProperty(field, resolveEntity))

  const decorators = new Set<string>(['Entity', 'PrimaryKey'])
  const entityImports = new Map<string, string>()
  const typeImports = new Set<string>()

  for (const prop of properties) {
    for (const dec of prop.decorators) decorators.add(dec)
    for (const [name, path] of prop.entityImports) {
      if (path !== `./${filePath.split('/').at(-1)?.replace(/\.ts$/, '')}`) {
        entityImports.set(name, path)
      }
    }
    for (const ti of prop.typeImports) typeImports.add(ti)
  }

  const body = [
    `@Entity({ tableName: '${diff.model}' })`,
    `export class ${className} {`,
    `  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })`,
    '  id!: string',
    '',
    properties.map(p => p.code).join('\n\n'),
    '}',
  ].join('\n')

  return { body, className, decorators, entityImports, typeImports }
}

interface RenderedEntity {
  body: string
  className: string
  decorators: Set<string>
  entityImports: Map<string, string>
  typeImports: Set<string>
}

/**
 * Enriches an existing decorator import with missing decorators.
 */
function ensureDecoratorImport(content: string, neededDecorators: Set<string>): string {
  const importRegex = /import \{([\w,\s]+)\} from '@mikro-orm\/decorators\/legacy'/
  const match = content.match(importRegex)

  if (!match) {
    return content
  }

  const existing = new Set(match[1]!.split(',').map(s => s.trim()).filter(Boolean))
  const missing = [...neededDecorators].filter(d => !existing.has(d))

  if (missing.length === 0) {
    return content
  }

  const all = [...existing, ...missing].toSorted()
  return content.replace(importRegex, `import { ${all.join(', ')} } from '@mikro-orm/decorators/legacy'`)
}

function ensureTypeImport(content: string, neededTypes: Set<string>): string {
  if (neededTypes.size === 0) {
    return content
  }

  const importRegex = /import type \{([\w,\s]+)\} from '@mikro-orm\/core'/
  const match = content.match(importRegex)

  if (!match) {
    return `import type { ${[...neededTypes].toSorted().join(', ')} } from '@mikro-orm/core'\n${content}`
  }

  const existing = new Set(match[1]!.split(',').map(s => s.trim()).filter(Boolean))
  const missing = [...neededTypes].filter(typeName => !existing.has(typeName))

  if (missing.length === 0) {
    return content
  }

  const all = [...existing, ...missing].toSorted()
  return content.replace(importRegex, `import type { ${all.join(', ')} } from '@mikro-orm/core'`)
}

function ensureEntityImports(content: string, entityImports: Map<string, string>): string {
  if (entityImports.size === 0) {
    return content
  }

  const imports = [...entityImports.entries()]
    .toSorted(([left], [right]) => left.localeCompare(right))
    .filter(([name]) => !new RegExp(`export\\s+class\\s+${name}\\b`).test(content))
    .map(([name, path]) => `import { ${name} } from '${path}'`)

  if (imports.length === 0) {
    return content
  }

  return `${imports.join('\n')}\n${content}`
}

function renderEntityFile(entity: RenderedEntity): string {
  const imports: string[] = []

  if (entity.typeImports.size > 0) {
    imports.push(`import type { ${[...entity.typeImports].toSorted().join(', ')} } from '@mikro-orm/core'`)
  }

  imports.push(`import { ${[...entity.decorators].toSorted().join(', ')} } from '@mikro-orm/decorators/legacy'`)

  for (const [name, path] of [...entity.entityImports.entries()].toSorted(([left], [right]) => left.localeCompare(right))) {
    imports.push(`import { ${name} } from '${path}'`)
  }

  return `${imports.join('\n')}\n\n${entity.body}\n`
}

function getMissingEntityFilePath(model: string, fallbackEntityFilePath: string): string {
  return resolve(dirname(fallbackEntityFilePath), 'entities', `${toKebabCase(toPascalCase(model))}.entity.ts`)
}

function getGeneratedEntityFiles(
  diffs: AuthSchemaModelDiff[],
  fallbackEntityFilePath: string,
): GeneratedEntityFiles {
  return new Map(diffs
    .filter(diff => !diff.metadata?.path)
    .map(diff => [diff.model, getMissingEntityFilePath(diff.model, fallbackEntityFilePath)]))
}

function ensureBarrelExports(
  content: string,
  barrelPath: string,
  renderedEntities: { entity: RenderedEntity, filePath: string }[],
): string {
  const lines = new Set(content.trimEnd().split('\n').filter(Boolean))

  for (const { entity, filePath } of renderedEntities) {
    lines.add(`export { ${entity.className} } from '${toImportPath(dirname(barrelPath), filePath)}'`)
  }

  return `${[...lines].join('\n')}\n`
}

/**
 * Trouve la position de fin d'une classe (le `}` de fermeture au bon niveau).
 */
function findClassEnd(content: string, className: string): number {
  const classRegex = new RegExp(`\\nexport\\s+class\\s+${className}\\s*\\{`)
  const match = classRegex.exec(content)

  if (!match) {
    return -1
  }

  let depth = 0
  const pos = match.index + match[0].length - 1

  for (let i = pos; i < content.length; i++) {
    const char = content[i]
    if (char === '{') {
      depth++
    }
    else if (char === '}') {
      depth--
      if (depth === 0) {
        return i
      }
    }
  }

  return -1
}

/**
 * Inserts missing properties into a class body.
 */
function insertPropertiesIntoClass(
  content: string,
  className: string,
  propertiesCode: string,
): string {
  const classStartRegex = new RegExp(`\\nexport\\s+class\\s+${className}\\s*\\{`)
  const startMatch = classStartRegex.exec(content)

  if (!startMatch) {
    return content
  }

  const classEnd = findClassEnd(content, className)
  if (classEnd === -1) {
    return content
  }

  const insertion = `\n${propertiesCode}\n`

  return content.slice(0, classEnd) + insertion + content.slice(classEnd)
}

interface ExistingEntityPatch {
  diff: AuthSchemaModelDiff
  propertiesCode: string
}

function groupExistingEntityPatches(
  diffs: AuthSchemaModelDiff[],
  orm: MikroORM,
  generatedEntityFiles: GeneratedEntityFiles,
): Map<string, ExistingEntityPatch[]> {
  const patchesByFile = new Map<string, ExistingEntityPatch[]>()

  for (const diff of diffs) {
    if (!diff.metadata?.path) {
      continue
    }

    const sourcePath = toSourcePath(diff.metadata.path)
    const resolveEntity = createEntityResolver(orm, resolve(sourcePath, '..'), generatedEntityFiles)
    const propertiesCode = diff.missingFields
      .map(field => renderProperty(field, resolveEntity).code)
      .join('\n\n')

    patchesByFile.set(sourcePath, [
      ...(patchesByFile.get(sourcePath) ?? []),
      { diff, propertiesCode },
    ])
  }

  return patchesByFile
}

function patchExistingEntityFile(
  filePath: string,
  patches: ExistingEntityPatch[],
  orm: MikroORM,
  generatedEntityFiles: GeneratedEntityFiles,
): string {
  let content = readFileSync(filePath, 'utf-8')
  const decorators = new Set<string>()
  const typeImports = new Set<string>()
  const entityImports = new Map<string, string>()
  const resolveEntity = createEntityResolver(orm, resolve(filePath, '..'), generatedEntityFiles)

  for (const { diff, propertiesCode } of patches) {
    for (const missingField of diff.missingFields) {
      const property = renderProperty(missingField, resolveEntity)
      for (const decorator of property.decorators) decorators.add(decorator)
      for (const typeImport of property.typeImports) typeImports.add(typeImport)
      for (const [name, path] of property.entityImports) entityImports.set(name, path)
    }

    content = insertPropertiesIntoClass(content, diff.metadata!.className, propertiesCode)
  }

  return ensureEntityImports(
    ensureTypeImport(
      ensureDecoratorImport(content, decorators),
      typeImports,
    ),
    entityImports,
  )
}

function renderMissingEntityFiles(
  missingEntities: AuthSchemaModelDiff[],
  orm: MikroORM,
  generatedEntityFiles: GeneratedEntityFiles,
): { entity: RenderedEntity, filePath: string, content: string }[] {
  return missingEntities.map((diff) => {
    const filePath = generatedEntityFiles.get(diff.model)!
    const entity = renderMissingEntity(diff, orm, filePath, generatedEntityFiles)
    return { entity, filePath, content: renderEntityFile(entity) }
  })
}

/**
 * Patches entity files discovered via MikroORM config.
 *
 * Reads each source file referenced by entity metadata,
 * inserts missing properties into existing classes,
 * and appends missing entity classes.
 *
 * When no existing entity is patched, new entities are written
 * to `fallbackEntityFilePath` (defaults to `src/modules/auth/auth.entity.ts`).
 *
 * @returns List of modified files (path → final content).
 */
export function applyEntityPatches(
  diffs: AuthSchemaModelDiff[],
  orm: MikroORM,
  fallbackEntityFilePath: string = DEFAULT_FALLBACK_ENTITY_FILE,
): Map<string, string> {
  const cwd = process.cwd()
  const absoluteFallbackPath = resolve(cwd, fallbackEntityFilePath)
  const files = new Map<string, string>()
  const generatedEntityFiles = getGeneratedEntityFiles(diffs, absoluteFallbackPath)
  const missingEntities = diffs.filter(diff => !diff.metadata?.path)
  const patchesByFile = groupExistingEntityPatches(diffs, orm, generatedEntityFiles)

  for (const [filePath, patches] of patchesByFile) {
    files.set(filePath, patchExistingEntityFile(filePath, patches, orm, generatedEntityFiles))
  }

  if (missingEntities.length > 0) {
    const renderedMissingEntities = renderMissingEntityFiles(missingEntities, orm, generatedEntityFiles)
    for (const { filePath, content } of renderedMissingEntities) {
      files.set(filePath, content)
    }

    const barrelContent = readFileSync(absoluteFallbackPath, 'utf-8')
    files.set(absoluteFallbackPath, ensureBarrelExports(barrelContent, absoluteFallbackPath, renderedMissingEntities))
  }

  return new Map([...files.entries()].map(([k, v]) => [relative(cwd, k), v]))
}
