---
id: unreleased/upgrade-vite-8
domain: frontend
classification: migration
pr: 134
---

# Upgrade Vite 7 to 8

## Goal

SPA and SSR apps resolve Vite 8.2.2 (Rolldown/Oxc), `pnpm-workspace.yaml` pins that version in `catalogs.build` and `overrides`, and each Vite config uses native `resolve.tsconfigPaths: true` instead of `vite-tsconfig-paths`.

## Why

Vite 8 replaces esbuild/Rollup with Rolldown and Oxc. The compatibility layer keeps existing `optimizeDeps` and React Router Environment API configs working. Vite 8 also resolves `tsconfig.json` `paths` natively, so `vite-tsconfig-paths` can go — that plugin was also the reason for the old `tsconfck` / TypeScript 5 peer comment. A catalog bump alone is not enough: transitives (`vite-node` via `@react-router/dev`, Vitest, Tailwind) can keep a nested Vite 7 unless `overrides.vite` pins 8.

Listing packages one by one is not this intention. Only `vite` moves, plus the plugin removal that the new resolver makes possible.

## Applies When

- The project tracks the `frontend` domain, or it has a Vite app with `vite.config.ts` (`apps/web-spa`, `apps/web-ssr`, or the project's equivalent).
- `catalogs.build.vite` is below 8, `overrides.vite` is missing or below 8, a Vite config still calls `tsconfigPaths()`, or `vite-tsconfig-paths` is still a dependency. Still being on Vite 7 with the plugin is the starting state this intention migrates away from, not a skip reason.

## Do Not Apply When

- The project has no Vite app (Next.js, a plain non-Vite SPA, API-only) — record as skipped.
- `@react-router/dev` (or the project's Vite-based framework) does not declare a Vite 8 peer — upgrade that framework first, or record as skipped with that reason.
- A Vite config uses `vite-tsconfig-paths` with options beyond the default plugin call — stop and ask; native `resolve.tsconfigPaths` may not be a drop-in.
- A human has reviewed this intention and decided to stay on Vite 7 — record as skipped with that reason.

## Observable Gaps

Skip any app directory that does not exist. Merge into existing `catalogs`, `overrides`, and `resolve` objects; do not replace them wholesale.

1. **Catalog Vite** — signal: `pnpm-workspace.yaml` `catalogs.build.vite` is missing or below `^8.2.2`.
   Set only that key to `^8.2.2`, matching the staged reference. Do not bump `typescript`, `@types/node`, or any other catalog family.
   Done when: `rg -n "vite:" pnpm-workspace.yaml` shows `^8.2.2` under `catalogs.build`.

2. **Override** — signal: `pnpm-workspace.yaml` `overrides` has no `vite`, or it is below `^8.2.2`.
   Add `vite: ^8.2.2` next to existing overrides (this repo already has `cookie`). Do not drop other override keys.
   Done when: `rg -n "vite:" pnpm-workspace.yaml` shows `^8.2.2` under `overrides`.

3. **Plugin dependency** — signal: an app `package.json` or `catalogs.build` still lists `vite-tsconfig-paths`.
   Remove that dependency from the Vite apps and from `catalogs.build` if present. Leave `vite: catalog:build` on the apps. Then `pnpm install`.
   Done when: `rg vite-tsconfig-paths pnpm-workspace.yaml apps/web-spa apps/web-ssr` (or the project's equivalent app dirs) returns nothing.

4. **Native path resolution** — signal: a `vite.config.ts` imports `vite-tsconfig-paths` or calls `tsconfigPaths()`, or it has no `resolve.tsconfigPaths: true`.
   Drop the import and the plugin. Set `resolve.tsconfigPaths: true`. If `resolve` already exists (aliases, conditions), add only that key.
   Done when: each remaining Vite app config matches `rg tsconfigPaths` on `resolve.tsconfigPaths` and `rg vite-tsconfig-paths` on that file returns nothing.

## Out of Scope

- Other `build` catalog keys (`typescript`, `@types/node`) and every other catalog family.
- React Router package bumps and `loaderData` — those stay on `unreleased/migrate-react-router-8` / `v1.1.0/migrate-react-router-8`.
- `future.unstable_optimizeDeps` and `optimizeDeps.include` — a different intention owns the lazy-route pre-bundle reload.
- Vitest major, Tailwind, or other Vite plugins (`@tailwindcss/vite`, `vite-plugin-devtools-json`).
- Route modules, UI, and `tsconfig.json` `paths` themselves.

## Reference Paths

- `pnpm-workspace.yaml` — **adapt**
- `apps/web-spa/package.json` — **adapt**
- `apps/web-ssr/package.json` — **adapt**
- `apps/web-spa/vite.config.ts` — **adapt**
- `apps/web-ssr/vite.config.ts` — **adapt**

## Validation

- `pnpm install` completes.
- `pnpm typecheck` passes.
- `pnpm lint` passes.
- `rg vite-tsconfig-paths apps pnpm-workspace.yaml` returns nothing.
- With the SPA (or SSR) dev server, an `@/` import still resolves (native `tsconfig` paths).

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/upgrade-vite-8 --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
