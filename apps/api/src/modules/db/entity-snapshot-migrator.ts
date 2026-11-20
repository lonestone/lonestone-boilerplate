import type { MikroORM } from '@mikro-orm/core'
import { Migrator as BaseMigrator } from '@mikro-orm/migrations'
import {
  type DatabaseSchema,
  SchemaComparator,
  type SqlEntityManager,
  type SqlSchemaGenerator,
} from '@mikro-orm/postgresql'

/**
 * The migrator, its snapshot spelled like the entities whenever the database
 * matches them. After `migration:up` or `migration:down`, MikroORM rewrites the
 * snapshot from the migrated database when the two differ (a hand-written
 * migration, a rollback), so that the next `migration:create` diffs the
 * entities against what the database really holds. An introspected snapshot
 * spells every index with its `expression`, though, and the next
 * `migration:create` rewrites hundreds of lines back. When the migrated
 * database holds exactly what the entities declare, the entities' spelling is
 * written instead; when it does not (a rollback, a change no entity carries
 * yet), the database's is kept, as MikroORM intends.
 *
 * Named `Migrator`: MikroORM adds its own migrator when no extension carries
 * that class name, and the last one registered wins.
 */
export class Migrator extends BaseMigrator {
  static override register(orm: MikroORM): void {
    orm.config.registerExtension(
      '@mikro-orm/migrator',
      () => new Migrator(orm.em as SqlEntityManager),
    )
  }

  protected override storeCurrentSchema(schema?: DatabaseSchema): Promise<void> {
    return super.storeCurrentSchema(schema && this.matchesEntities(schema) ? undefined : schema)
  }

  /** Whether the introspected schema differs from the entities in nothing the comparator turns into SQL. */
  private matchesEntities(schema: DatabaseSchema): boolean {
    const generator = this.config.getExtension<SqlSchemaGenerator>('@mikro-orm/schema-generator')
    if (!generator) return false
    const diff = new SchemaComparator(this.driver.getPlatform()).compare(
      schema,
      generator.getTargetSchema(),
    )
    return (
      generator.diffToSQL(diff, { wrap: false, safe: false, dropTables: true }).trim().length === 0
    )
  }
}
