import { MikroORM } from '@mikro-orm/core'
import { createMikroOrmOptions } from './modules/db/db.config'

/**
 * Production migrator (`node dist/migrate.js`).
 *
 * The image has no `src/`, so the MikroORM CLI cannot run. Vite emits this
 * file; SWC emits `dist/modules/db/migrations/*.js` for folder discovery.
 * `snapshot: false` avoids rewriting `snapshot.json` on a read-only image.
 */
const orm = await MikroORM.init(createMikroOrmOptions({ migrations: { snapshot: false } }))

try {
  await orm.migrator.up()
} finally {
  await orm.close(true)
}
