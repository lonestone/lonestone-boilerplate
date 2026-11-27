import { resolve } from 'node:path'
import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

const swcPlugin = swc.vite({
  module: { type: 'es6' },
})

/** An absolute glob with forward slashes: Vitest matches the triggers with picomatch, even on Windows. */
const projectGlob = (path: string): string => resolve(__dirname, path).replaceAll('\\', '/')

const resolveAlias = {
  src: resolve(__dirname, './src'),
}

export default defineConfig({
  build: {
    sourcemap: true,
  },
  server: {
    fs: {
      strict: false,
    },
  },
  plugins: [swcPlugin],
  resolve: {
    alias: resolveAlias,
  },
  test: {
    root: resolve(__dirname, './src/test'),
    environment: 'node',
    pool: 'threads',
    globals: true,
    globalSetup: resolve(__dirname, './src/test/setup/test.global-setup.ts'),
    // `--changed` follows the imports of the test files. It cannot see the setup files, the schema
    // built from every entity, the config nor the dependencies: a change to one of them runs every test.
    forceRerunTriggers: [
      projectGlob('package.json'),
      projectGlob('tsconfig.json'),
      projectGlob('vitest.config.ts'),
      projectGlob('src/test/**'),
      projectGlob('src/**/*.entity.ts'),
      projectGlob('src/modules/db/**'),
      projectGlob('../../pnpm-lock.yaml'),
    ],
    projects: [
      {
        plugins: [swcPlugin],
        resolve: { alias: resolveAlias },
        test: {
          name: 'unit',
          globals: true,
          environment: 'node',
          include: ['../**/*.spec.ts'],
          setupFiles: [resolve(__dirname, './src/test/setup/test.setup.ts')],
        },
      },
      {
        plugins: [swcPlugin],
        resolve: { alias: resolveAlias },
        test: {
          name: 'e2e',
          // A worker loads the app modules once and reuses them for its next test files.
          // Each test still gets an emptied database and its own app (test.e2e-setup.ts).
          isolate: false,
          globals: true,
          environment: 'node',
          include: ['../**/*.e2e-spec.ts'],
          setupFiles: [
            resolve(__dirname, './src/test/setup/test.setup.ts'),
            resolve(__dirname, './src/test/setup/test.e2e-setup.ts'),
          ],
          // Container startup (PostgreSQL via testcontainers) can take >10s in CI
          hookTimeout: 60000,
        },
      },
    ],
  },
})
