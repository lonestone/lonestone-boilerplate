// GLOBAL TEST SETUP
//
// This file runs BEFORE any modules are loaded, ensuring environment variables
// are set before env.config.ts validates them.
// Test containers are now managed per test for maximum isolation.

export async function setup() {
  process.env.NODE_ENV = 'test'
  process.env.CLIENTS_WEB_APP_URL = 'http://localhost:3000'
  process.env.CLIENTS_WEB_SSR_URL = 'http://localhost:5174'
  process.env.S3_ENDPOINT = 'http://localhost:9000'
  process.env.S3_REGION = 'us-east-1'
  process.env.S3_ACCESS_KEY_ID = 'minioadmin'
  process.env.S3_SECRET_ACCESS_KEY = 'minioadmin'
  process.env.S3_BUCKET = 'test'

  // API and Auth variables
  process.env.API_PORT = '3000'
  process.env.BETTER_AUTH_SECRET = 'test-secret-key-for-testing-only'
  process.env.TRUSTED_ORIGINS = 'http://localhost:3000'

  // Database variables - minimal defaults for env.config.ts validation
  // These will be overridden by individual test containers
  process.env.DATABASE_PASSWORD = 'test'
  process.env.DATABASE_USER = 'test'
  process.env.DATABASE_NAME = 'test'
  process.env.DATABASE_HOST = 'localhost'
  process.env.DATABASE_PORT = '5432'

  // AI variables
  process.env.MISTRAL_API_KEY = 'test'
  process.env.LANGFUSE_SECRET_KEY = 'test'
  process.env.LANGFUSE_PUBLIC_KEY = 'test'
  process.env.LANGFUSE_BASE_URL = 'http://localhost:3000'
  process.env.AI_DISABLED = 'true'
}
