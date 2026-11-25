import process from 'node:process'
import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv, lazyPlugins } from 'vite-plus'
import devtoolsJson from 'vite-plugin-devtools-json'

// `pnpm worktree:create` writes the dev port in the root .env of a worktree, so two
// worktrees do not fight for the same port. Without it, the port below is used.
// Keep the literal `port: <number>`: the init CLI rewrites it.
const rootEnv = loadEnv(process.env.NODE_ENV ?? 'development', '../..', 'WEB_SPA_PORT')

export default defineConfig({
  plugins: lazyPlugins(() => [tailwindcss(), reactRouter(), devtoolsJson()]),
  resolve: {
    tsconfigPaths: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV === 'development',
  },
  server: {
    port: 5174,
    ...(rootEnv.WEB_SPA_PORT ? { port: Number(rootEnv.WEB_SPA_PORT) } : {}),
  },
  optimizeDeps: {
    include: ['@tanstack/react-query', 'zod'],
  },
})
