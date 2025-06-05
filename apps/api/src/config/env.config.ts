import dotenvx from '@dotenvx/dotenvx'
import { z } from 'zod'

// Load environment variables
dotenvx.config()

export const configValidationSchema = z.object({
  // Environment
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // API
  API_PORT: z.coerce.number(),

  // Database
  DATABASE_PASSWORD: z.string(),
  DATABASE_USER: z.string(),
  DATABASE_NAME: z.string(),
  DATABASE_HOST: z.string(),
  DATABASE_PORT: z.coerce.number(),

  // BetterAuth
  BETTER_AUTH_SECRET: z.string(),
  TRUSTED_ORIGINS: z.string().transform(val => val.split(',')),

  // AI
  LANGFUSE_PUBLIC_KEY: z.string(),
  LANGFUSE_SECRET_KEY: z.string(),
  OPEN_AI_API_KEY: z.string(),
})

export type ConfigSchema = z.infer<typeof configValidationSchema>

const configParsed = configValidationSchema.safeParse(process.env)

if (!configParsed.success) {
  throw new Error(
    `Invalid environment variables: ${JSON.stringify(
      configParsed.error.format(),
      null,
      4,
    )}`,
  )
}

export const config = {
  env: configParsed.data.NODE_ENV,
  apiPort: configParsed.data.API_PORT,
  betterAuth: {
    secret: configParsed.data.BETTER_AUTH_SECRET,
    trustedOrigins: configParsed.data.TRUSTED_ORIGINS,
  },
  database: {
    password: configParsed.data.DATABASE_PASSWORD,
    user: configParsed.data.DATABASE_USER,
    name: configParsed.data.DATABASE_NAME,
    host: configParsed.data.DATABASE_HOST,
    port: configParsed.data.DATABASE_PORT,
    connectionStringUrl: `postgresql://${configParsed.data.DATABASE_USER}:${configParsed.data.DATABASE_PASSWORD}@${configParsed.data.DATABASE_HOST}:${configParsed.data.DATABASE_PORT}/${configParsed.data.DATABASE_NAME}`,
  },
  ai: {
    langfusePublicKey: configParsed.data.LANGFUSE_PUBLIC_KEY,
    langfuseSecretKey: configParsed.data.LANGFUSE_SECRET_KEY,
    openAiApiKey: configParsed.data.OPEN_AI_API_KEY,
  },
} as const
