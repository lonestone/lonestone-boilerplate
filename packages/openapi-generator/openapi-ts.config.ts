import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig({
  input:
    './tmp/openapi.json',
  output: {
    postProcess: ['eslint', 'prettier'],
    path: './client',
  },
  plugins: [
    {
      name: '@hey-api/client-fetch',
    },
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
