import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import dotenvx from '@dotenvx/dotenvx'
import { z } from 'zod'

// Load environment variables
const nodeEnv = process.env.NODE_ENV || 'development'
if (nodeEnv === 'test') {
  dotenvx.config({ path: join(process.cwd(), '.env.example') })
}
else {
  dotenvx.config({ path: join(process.cwd(), '.env') })
}

function getVersion() {
  const packageJson = readFileSync(join(process.cwd(), 'package.json'), 'utf8')

  if (!packageJson) {
    console.warn('Failed to read package.json')
    return 'Unknown version'
  }

  try {
    const packageJsonData = JSON.parse(packageJson)

    return packageJsonData.version ?? 'Unknown version'
  }
  catch {
    console.warn('Failed to parse package.json version')
    return 'Unknown version'
  }
}

export const configValidationSchema = z.object({
  // Environment
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // API
  API_BASE_URL: z.string().url().optional().default('http://localhost:3000'),
  API_PORT: z.coerce.number().optional().default(3000),

  // Database
  DATABASE_PASSWORD: z.string().optional().default('postgres'),
  DATABASE_USER: z.string().optional().default('postgres'),
  DATABASE_NAME: z.string().optional().default('lonestone'),
  DATABASE_HOST: z.string().optional().default('localhost'),
  DATABASE_PORT: z.coerce.number().optional().default(5432),

  // BetterAuth
  BETTER_AUTH_SECRET: z.string().optional().default('your_secret_here_min_32_chars_use_openssl_rand_base64_32'),
  TRUSTED_ORIGINS: z.string().transform(val => val.split(',')).optional().default(['http://localhost:3000']),

  // Clients
  CLIENTS_WEB_APP_URL: z.string().optional().default('http://localhost:5173'),
  CLIENTS_WEB_SSR_URL: z.string().optional().default('http://localhost:5174'),

  // Email
  EMAIL_HOST: z.string().default('localhost'),
  EMAIL_PORT: z.coerce.number().default(1025),
  EMAIL_SECURE: z.stringbool().default(false),
  EMAIL_USER: z.string().optional(),
  EMAIL_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().email().default('noreply@lonestone.io'),

  // AI Providers
  OPENAI_API_KEY: z.string().optional(), // OpenAI
  ANTHROPIC_API_KEY: z.string().optional(), // Anthropic
  GOOGLE_API_KEY: z.string().optional(), // Google
  MISTRAL_API_KEY: z.string().optional(), // Mistral

  // Langfuse
  LANGFUSE_SECRET_KEY: z.string().optional(),
  LANGFUSE_PUBLIC_KEY: z.string().optional(), // Optional
  LANGFUSE_BASE_URL: z.string().optional(), // Optional, defaults to cloud

  // Sentry
  SENTRY_DSN: z.string().optional(),
})

export type ConfigSchema = z.infer<typeof configValidationSchema>

const configParsed = configValidationSchema.safeParse(process.env)

if (!configParsed.success) {
  throw new Error(
    `Invalid environment variables: ${JSON.stringify(
      z.treeifyError(configParsed.error),
      null,
      4,
    )}`,
  )
}

export const config = {
  env: configParsed.data.NODE_ENV,
  api: {
    baseUrl: configParsed.data.API_BASE_URL,
    port: configParsed.data.API_PORT,
  },
  version: getVersion(),
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
  email: {
    host: configParsed.data.EMAIL_HOST,
    port: configParsed.data.EMAIL_PORT,
    secure: configParsed.data.EMAIL_SECURE,
    user: configParsed.data.EMAIL_USER,
    password: configParsed.data.EMAIL_PASSWORD,
    from: configParsed.data.EMAIL_FROM,
  },
  clients: {
    webApp: {
      url: configParsed.data.CLIENTS_WEB_APP_URL,
    },
    webSsr: {
      url: configParsed.data.CLIENTS_WEB_SSR_URL,
    },
  },
  langfuse: {
    secretKey: configParsed.data.LANGFUSE_SECRET_KEY,
    publicKey: configParsed.data.LANGFUSE_PUBLIC_KEY,
    host: configParsed.data.LANGFUSE_BASE_URL,
  },
  ai: {
    providers: {
      openai: {
        apiKey: configParsed.data.OPENAI_API_KEY,
      },
      anthropic: {
        apiKey: configParsed.data.ANTHROPIC_API_KEY,
      },
      google: {
        apiKey: configParsed.data.GOOGLE_API_KEY,
      },
      mistral: {
        apiKey: configParsed.data.MISTRAL_API_KEY,
      },
    },
  },
  sentry: {
    dsn: configParsed.data.SENTRY_DSN,
  },
} as const
