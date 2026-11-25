import { defineConfig } from 'vite-plus'

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    setupFiles: ['src/vitest.setup.ts'],
    testTimeout: 30_000,
  },
})
