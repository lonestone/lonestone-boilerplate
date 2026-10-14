import { MikroORM } from '@mikro-orm/postgresql'
import { Client } from 'pg'
import { config } from './config/env.config'
import { createMikroOrmOptions } from './modules/db/db.config'

// Every API instance takes this lock before migrating. When several instances
// start together, one applies the pending migrations and the others wait, then
// find nothing left to apply. Any constant works as long as it never changes.
const MIGRATION_LOCK_KEY = 4_215_097_331

async function migrate() {
  // A dedicated connection: an advisory lock belongs to the session that took
  // it, and the ORM pool may run each query on a different connection.
  const lockClient = new Client({
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    database: config.database.name,
  })
  await lockClient.connect()

  try {
    await lockClient.query('select pg_advisory_lock($1)', [MIGRATION_LOCK_KEY])

    const orm = await MikroORM.init(createMikroOrmOptions())
    try {
      const applied = await orm.migrator.up()
      console.log(
        applied.length > 0
          ? `Applied migrations: ${applied.map((migration) => migration.name).join(', ')}`
          : 'No pending migrations',
      )
    } finally {
      await orm.close(true)
    }
  } finally {
    // Ending the session releases the lock.
    await lockClient.end()
  }
}

migrate().catch((error: unknown) => {
  console.error('Migration failed', error)
  process.exit(1)
})
