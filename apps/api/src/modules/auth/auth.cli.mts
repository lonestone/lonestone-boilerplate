import type { MikroORM as MikroORMClass } from '@mikro-orm/core'
import type { createMikroOrmOptions as CreateMikroOrmOptions } from '../db/db.config.js'
import type { createBetterAuth as CreateBetterAuth } from './auth.config.js'

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
require('reflect-metadata')
require('@swc-node/register')

const { MikroORM } = require('@mikro-orm/core') as { MikroORM: typeof MikroORMClass }
const { createBetterAuth } = require('./auth.config.ts') as {
  createBetterAuth: typeof CreateBetterAuth
}
const { createMikroOrmOptions } = require('../db/db.config.ts') as {
  createMikroOrmOptions: typeof CreateMikroOrmOptions
}
const { config } = require('../../config/env.config.ts') as {
  config: typeof import('../../config/env.config.js').config
}

function importEntity(path: string): Promise<unknown> {
  return Promise.resolve(require(path.startsWith('file://') ? fileURLToPath(path) : path))
}

const orm = await MikroORM.init(
  createMikroOrmOptions({
    debug: false,
    dynamicImportProvider: importEntity,
  }),
)

export const auth = createBetterAuth({
  orm,
  baseUrl: config.api.baseUrl,
  secret: config.betterAuth.secret,
  trustedOrigins: config.betterAuth.trustedOrigins,
})
