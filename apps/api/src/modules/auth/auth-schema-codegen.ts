import type { MikroORM } from '@mikro-orm/core'
import type { AuthSchemaField, AuthSchemaModelDiff } from './auth-db.adapter'
import { readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'

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
    )
    const metadata = [...metadataStore.getAll().values()].find(meta => meta.className === entityName)

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

  if (field.field !== toSnakeCase(field.field))
    options.push(`fieldName: '${field.field}'`)

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

function renderMissingEntity(diff: AuthSchemaModelDiff, orm: MikroORM, filePath: string): RenderedEntity {
  const resolveEntity = createEntityResolver(orm, resolve(filePath, '..'))
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
    `@Entity({ tableName: '${toSnakeCase(diff.model)}' })`,
    `export class ${className} {`,
    `  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })`,
    '  id!: string',
    '',
    properties.map(p => p.code).join('\n\n'),
    '}',
  ].join('\n').replace(/^/gm, '')

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
 * Enrichit l'import de décorateurs existant avec les décorateurs manquants.
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
 * Ajoute les propriétés manquantes dans le corps d'une classe.
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

/**
 * Ajoute une ou plusieurs classes d'entité manquantes à la fin du fichier.
 */
function appendClasses(content: string, entities: RenderedEntity[]): string {
  const blocks = entities.map(e => `\n${e.body}\n`).join('\n')
  const trimmed = content.trimEnd()
  return `${trimmed}\n${blocks}`
}

/**
 * Patch les fichiers d'entités découverts via la config MikroORM.
 *
 * Lit chaque fichier source référencé par les métadonnées des entités,
 * y insère les propriétés manquantes dans les classes existantes
 * et ajoute les nouvelles classes d'entité manquantes.
 *
 * @returns La liste des fichiers modifiés (chemin → contenu final).
 */
export function applyEntityPatches(
  diffs: AuthSchemaModelDiff[],
  orm: MikroORM,
): Map<string, string> {
  const files = new Map<string, string>()

  // Groupe les diffs par fichier source
  const missingEntities: AuthSchemaModelDiff[] = []
  const bySourceFile = new Map<string, { diff: AuthSchemaModelDiff, propertiesCode: string }[]>()

  for (const diff of diffs) {
    if (diff.metadata?.path) {
      const sourcePath = toSourcePath(diff.metadata.path)
      const resolveEntity = createEntityResolver(orm, resolve(sourcePath, '..'))
      const propertiesCode = diff.missingFields
        .map(field => renderProperty(field, resolveEntity).code)
        .join('\n\n')

      if (!bySourceFile.has(sourcePath)) {
        bySourceFile.set(sourcePath, [])
      }
      bySourceFile.get(sourcePath)!.push({ diff, propertiesCode })
    }
    else {
      missingEntities.push(diff)
    }
  }

  const missingEntitiesTarget = bySourceFile.keys().next().value

  // Applique les patchs pour chaque fichier existant
  for (const [filePath, patches] of bySourceFile) {
    let content = readFileSync(filePath, 'utf-8')
    const allDecorators = new Set<string>()
    const allTypeImports = new Set<string>()
    const allEntityImports = new Map<string, string>()

    for (const { diff, propertiesCode } of patches) {
      const resolveEntity = createEntityResolver(orm, resolve(filePath, '..'))
      for (const missingField of diff.missingFields) {
        const propertyAnnotations = renderProperty(missingField, resolveEntity)
        for (const decorator of propertyAnnotations.decorators) allDecorators.add(decorator)
        for (const typeImport of propertyAnnotations.typeImports) allTypeImports.add(typeImport)
      }

      content = insertPropertiesIntoClass(content, diff.metadata!.className, propertiesCode)
    }

    // Ajoute les nouvelles classes d'entité manquantes (les orienter vers un fichier contenant une entité du même domaine)
    if (missingEntities.length > 0 && filePath === missingEntitiesTarget) {
      const rendered = missingEntities.map(diff => renderMissingEntity(diff, orm, filePath))
      for (const entity of rendered) {
        for (const dec of entity.decorators) allDecorators.add(dec)
        for (const typeImport of entity.typeImports) allTypeImports.add(typeImport)
        for (const [name, path] of entity.entityImports) allEntityImports.set(name, path)
      }
      content = ensureDecoratorImport(content, allDecorators)
      content = ensureTypeImport(content, allTypeImports)
      content = ensureEntityImports(content, allEntityImports)
      content = appendClasses(content, rendered)
    }
    else {
      content = ensureDecoratorImport(content, allDecorators)
      content = ensureTypeImport(content, allTypeImports)
    }

    files.set(filePath, content)
  }

  // Si aucune entité existante n'est patchée mais qu'il y a des entités manquantes,
  // on ne peut pas déterminer le fichier de destination → on retourne vide
  if (bySourceFile.size === 0 && missingEntities.length > 0) {
    return files
  }

  return files
}
