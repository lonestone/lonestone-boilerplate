import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import dotenvx from '@dotenvx/dotenvx'
import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

const apiRoot = import.meta.dirname
const migrationsDir = resolve(apiRoot, 'src/modules/db/migrations')

const swcPlugin = swc.vite({
  module: { type: 'es6' },
})

const resolveAlias = {
  src: resolve(apiRoot, './src'),
}

export default defineConfig(({ mode }) => {
  // Tests run on the example values. Dev and start get `.env` from `dotenvx run`, so a missing
  // key fails the Zod validation in env.config.ts instead of falling back to an example value.
  if (mode === 'test') {
    dotenvx.config({ path: resolve(apiRoot, '.env.example') })
  }

  return {
    appType: 'custom',
    plugins: [swcPlugin],
    resolve: {
      alias: resolveAlias,
    },
    server: {
      fs: {
        strict: false,
      },
    },
    ssr: {
      target: 'node',
    },
    build: {
      ssr: true,
      sourcemap: true,
      minify: false,
      target: 'node24',
      outDir: 'dist',
      emptyOutDir: true,
      rolldownOptions: {
        // The MikroORM CLI in the image loads dist/modules/db/db.config.js (MIKRO_ORM_CLI_CONFIG)
        // and finds the migrations in dist/modules/db/migrations: as entries, they keep their exports.
        input: [
          resolve(apiRoot, 'src/main.ts'),
          resolve(apiRoot, 'src/modules/db/db.config.ts'),
          ...readdirSync(migrationsDir)
            .filter((file) => file.endsWith('.ts'))
            .map((file) => resolve(migrationsDir, file)),
        ],
        output: {
          format: 'es',
          // One file per module: a bundle renames clashing class names (Post becomes Post$1),
          // which would rename MikroORM entities and OpenAPI schemas.
          preserveModules: true,
          preserveModulesRoot: resolve(apiRoot, 'src'),
          entryFileNames: '[name].js',
        },
      },
    },
    test: {
      root: resolve(apiRoot, './src/test'),
      environment: 'node',
      pool: 'threads',
      globals: true,
      globalSetup: resolve(apiRoot, './src/test/setup/test.global-setup.ts'),
      projects: [
        {
          plugins: [swcPlugin],
          resolve: { alias: resolveAlias },
          test: {
            name: 'unit',
            globals: true,
            environment: 'node',
            include: ['../**/*.spec.ts'],
            setupFiles: [resolve(apiRoot, './src/test/setup/test.setup.ts')],
          },
        },
        {
          plugins: [swcPlugin],
          resolve: { alias: resolveAlias },
          test: {
            name: 'e2e',
            globals: true,
            environment: 'node',
            include: ['../**/*.e2e-spec.ts'],
            setupFiles: [
              resolve(apiRoot, './src/test/setup/test.setup.ts'),
              resolve(apiRoot, './src/test/setup/test.e2e-setup.ts'),
            ],
            // Container startup (PostgreSQL via testcontainers) can take >10s in CI
            hookTimeout: 60000,
          },
        },
      ],
    },
  }
})
