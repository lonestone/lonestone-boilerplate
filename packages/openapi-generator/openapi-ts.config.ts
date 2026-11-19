import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig({
  input: './tmp/openapi.json',
  output: {
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
    {
      name: 'zod',
      '~resolvers': {
        // Multipart file fields are `format: binary`. Without this, zod.gen.ts validates them as strings.
        string: ({ $, schema, symbols }) =>
          schema.format === 'binary' ? $(symbols.z).attr('instanceof').call($('Blob')) : undefined,
      },
    },
  ],
})
