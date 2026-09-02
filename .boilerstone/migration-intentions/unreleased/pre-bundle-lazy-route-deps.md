---
id: unreleased/pre-bundle-lazy-route-deps
domain: frontend
classification: migration
pr: 152
---

# Pre-bundle lazy route dependencies in dev

## Goal

Every React Router app sets `future.unstable_optimizeDeps: true` in its `react-router.config.ts`, so the Vite dependency scanner sees the client entry and all route modules at server start.

## Why

The React Router Vite plugin passes `optimizeDeps.entries: []` to Vite unless that flag is set (`getOptimizeDepsEntries` in `@react-router/dev/dist/vite.js` returns an empty array first thing). Vite reads a defined array as an explicit pattern, so it does not fall back to crawling `**/*.html`, and a React Router app has no `index.html` on disk anyway. The scanner therefore has no entry point at all and pre-bundles only what the plugin lists in `optimizeDeps.include`.

Everything else is discovered lazily. The first navigation to a route whose chunk pulls a dependency no loaded route uses (a chart library on an admin page, a rich text editor on an editor page) makes Vite re-run the optimizer. That changes the browser hash, the already-loaded modules 504 as outdated, and the dev server hard-reloads the page in the middle of a client-side navigation. The next click works, which makes it read like a random glitch rather than a cache miss.

Listing the offending packages in `optimizeDeps.include` in `vite.config.ts` fixes one case at a time and has to be repeated for every dependency exclusive to a route, so it was rejected in favour of the flag. The flag is prefixed `unstable_`, but it only feeds paths to the scanner: no runtime behaviour changes, and it costs a slightly longer first dev server start.

## Applies When

- The project has an app built with `@react-router/dev` (`react-router.config.ts` at the app root).
- That config has no `future.unstable_optimizeDeps`. Not having it is the starting state this intention migrates away from, not a skip reason.

## Do Not Apply When

- The project has no React Router app (a plain Vite SPA, Next.js, …) — record as skipped.
- `@react-router/dev` is older than 7.2, which is where the flag landed — upgrade first, or record as skipped with that reason.
- A human has reviewed this intention and decided to keep the per-dependency `optimizeDeps.include` approach — record as skipped with that reason.

## Observable Gaps

1. **web-spa config** — signal: `apps/web-spa/react-router.config.ts` has no `future` key.
   Add `future: { unstable_optimizeDeps: true }` next to `ssr`, matching the staged reference. Keep the project's own `ssr`, `prerender`, `basename` and `appDirectory` values.
   Done when: `rg unstable_optimizeDeps apps/web-spa/react-router.config.ts` matches and `pnpm --filter=web-spa typecheck` passes.

2. **web-ssr config** — signal: `apps/web-ssr/react-router.config.ts` has no `future` key.
   Same edit. It matters less there (an SSR app gives the scanner an entry through the server build) but the client graph is scanned the same way, so keep the two apps aligned.
   Done when: `rg unstable_optimizeDeps apps/web-ssr/react-router.config.ts` matches and `pnpm --filter=web-ssr typecheck` passes.

3. **Redundant per-dependency includes** — signal: `vite.config.ts` lists a route-only package in `optimizeDeps.include` with a comment about page reloads or dependency discovery.
   Those entries become redundant once the scanner sees the route modules. Remove only the ones added for this reason; keep entries that exist for other reasons (a CJS dependency needing interop, a package the scanner cannot resolve).
   Done when: no `optimizeDeps.include` entry is justified by "avoid a reload on first navigation".

## Out of Scope

- The route tree, route module contents, and any `lazy` boundary.
- Adding or removing frontend dependencies.
- `vite.config.ts` beyond the redundant `optimizeDeps.include` entries described above.
- Any other `future` flag: this intention adds exactly one key.

## Reference Paths

- `apps/web-spa/react-router.config.ts` — **adapt**
- `apps/web-ssr/react-router.config.ts` — **adapt**

## Validation

- `pnpm typecheck` passes.
- `pnpm lint` passes.
- With the dev server started cold (`rm -rf apps/web-spa/node_modules/.vite` first), navigating from the first page to a route that no other page shares dependencies with does not reload the page. The dev server logs no `new dependencies optimized` line after the initial start.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/pre-bundle-lazy-route-deps --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
