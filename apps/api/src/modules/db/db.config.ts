import { defineConfig } from 'drizzle-kit'
import { config } from '../../config/env.config'

export default defineConfig({
  schema: './schemas/*.schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: config.database.connectionStringUrl,
  },
  verbose: true,
  strict: true,
})
