import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

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
  resolve: {
    alias: resolveAlias,
  },
  test: {
    root: resolve(__dirname, './src/test'),
    environment: 'node',
    pool: 'threads',
    globals: true,
    globalSetup: [],
    projects: [
      {
        resolve: { alias: resolveAlias },
        test: {
          name: 'unit',
          globals: true,
          environment: 'node',
          include: [
            '../**/*.spec.ts',
          ],
          setupFiles: [
            resolve(__dirname, './src/test/setup/test.setup.ts'),
          ],
        },
      },
      {
        resolve: { alias: resolveAlias },
        test: {
          name: 'e2e',
          globals: true,
          environment: 'node',
          include: [
            '../**/*.e2e-spec.ts',
          ],
          globalSetup: [
            resolve(__dirname, './src/test/setup/test.global-setup.ts'),
          ],
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
