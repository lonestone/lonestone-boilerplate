import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Only collect our own specs: upgrade/ holds extracted reference copies of
    // the repository (including spec files) that must never run as tests
    include: ['cli/**/*.spec.ts'],
    setupFiles: ['cli/vitest.setup.ts'],
    // Several tests spawn the CLI multiple times through `pnpm exec tsx`,
    // paying a ~2s cold start per invocation
    testTimeout: 30_000,
  },
})
