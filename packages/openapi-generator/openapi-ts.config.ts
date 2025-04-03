import process from 'node:process'
import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig({
  input:
    `http://localhost:${process.env.API_PORT}/docs-json`,
  output: {
    format: 'prettier',
    lint: 'eslint',
    path: './client',
  },
  plugins: [
    '@hey-api/client-fetch',
    '@hey-api/schemas',
    {
      dates: true,
      name: '@hey-api/transformers',
    },
    {
      enums: 'javascript',
      name: '@hey-api/typescript',
    },
    {
      name: '@hey-api/sdk',
      transformer: true,
    },
    'zod',
  ],
})
