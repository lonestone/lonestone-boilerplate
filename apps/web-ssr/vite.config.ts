import process from 'node:process'
import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import devtoolsJson from 'vite-plugin-devtools-json'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
    devtoolsJson(),
  ],
  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV === 'development',
  },
  server: {
    port: 5173,
  },
  optimizeDeps: {
    // Preload tanstack react query to avoid hydration error
    // See: https://react-query.tanstack.com/guides/window-undefined
    include: ['@tanstack/react-query'],
  },
})
