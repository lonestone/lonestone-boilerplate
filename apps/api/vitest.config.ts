import path from 'node:path'
import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    root: './',
    globalSetup: path.resolve(__dirname, './src/test/test.global-setup.ts'),

    projects: [
      {
        test: {
          globals: true,
          root: './',
          include: ['**/*.e2e-spec.ts'],
          hookTimeout: 60_000,
          setupFiles: [
            path.resolve(__dirname, './src/test/test.setup.ts'),
            path.resolve(__dirname, './src/test/test.e2e-setup.ts'),
          ],
        },
      },
      {
        test: {
          globals: true,
          root: './',
          include: ['**/*.spec.ts'],
          setupFiles: [
            path.resolve(__dirname, './src/test/test.setup.ts'),
          ],
        },
      },
    ],
  },
  plugins: [
    // This is required to build the test files with SWC
    swc.vite({
      // Explicitly set the module type to avoid inheriting this value from a `.swcrc` config file
      module: { type: 'es6' },
    }),
  ],
  resolve: {
    alias: {
      // Ensure Vitest correctly resolves TypeScript path aliases
      src: path.resolve(__dirname, './src'),
    },
  },
})
