import type { Config } from '@react-router/dev/config'

export default {
  // Config options...
  // Server-side render by default, to enable SPA mode set this to `false`
  ssr: false,
  future: {
    // Feed the client entry and every route module to Vite's dependency
    // scanner. Without it the plugin passes an empty `optimizeDeps.entries`,
    // which Vite reads as an explicit (empty) pattern rather than falling back
    // to its `**/*.html` crawl. Nothing gets scanned, so a dependency imported
    // only by a lazy route is discovered on first navigation, and the
    // re-optimization forces a full page reload mid-navigation.
    unstable_optimizeDeps: true,
  },
} satisfies Config
