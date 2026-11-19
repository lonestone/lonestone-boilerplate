import process from 'node:process'
import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import devtoolsJson from 'vite-plugin-devtools-json'

// The dev port comes from the root .env (written by `pnpm worktree:create`), so two
// worktrees do not fight for the same port. process.env wins over the file.
const rootEnv = loadEnv(process.env.NODE_ENV ?? 'development', '../..', 'WEB_SSR_PORT')

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), devtoolsJson()],
  resolve: {
    tsconfigPaths: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV === 'development',
  },
  server: {
    port: Number(rootEnv.WEB_SSR_PORT ?? 5173),
  },
  optimizeDeps: {
    // Preload tanstack react query to avoid hydration error
    // See: https://react-query.tanstack.com/guides/window-undefined
    include: ['@tanstack/react-query'],
  },
})
