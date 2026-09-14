import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    setupFiles: ['src/vitest.setup.ts'],
    testTimeout: 30_000,
  },
})
