import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input:
    'http://localhost:3000/docs-json',
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
    'zod'
  ],
});
