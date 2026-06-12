import 'reflect-metadata'
import { MikroORM } from '@mikro-orm/core'

process.env.API_BASE_URL ??= 'http://localhost:3000'
process.env.API_PORT ??= '3000'
process.env.BETTER_AUTH_SECRET ??= 'better-auth-cli-introspection-secret'
process.env.CLIENTS_WEB_APP_URL ??= 'http://localhost:5173'
process.env.CLIENTS_WEB_SSR_URL ??= 'http://localhost:5174'
process.env.DATABASE_HOST ??= 'localhost'
process.env.DATABASE_NAME ??= 'boilerstone'
process.env.DATABASE_PASSWORD ??= 'postgres'
process.env.DATABASE_PORT ??= '5432'
process.env.DATABASE_USER ??= 'postgres'
process.env.TRUSTED_ORIGINS ??= 'http://localhost:5173,http://localhost:5174'

const [{ createBetterAuth }, { createMikroOrmOptions }] = await Promise.all([
  import('./dist/config/better-auth.config.js'),
  import('./dist/config/mikro-orm.config.js'),
])

export const auth = createBetterAuth({
  baseUrl: process.env.API_BASE_URL,
  orm: await MikroORM.init(createMikroOrmOptions({ debug: false })),
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: process.env.TRUSTED_ORIGINS.split(','),
})
