---
id: unreleased/adopt-tsgo
domain: tooling
classification: migration
pr: 151
---

# Type-check and build with tsgo

## Goal

Every `typecheck` and `tsc` build script runs `tsgo` (`@typescript/native-preview`, catalog `build`), and no tsconfig sets `baseUrl` or `ignoreDeprecations`.

## Why

`tsgo` is the native port of the TypeScript compiler. On this repository `apps/api` type-checks in 1.3s instead of 4.6s, and the whole workspace in about 2s, so the pre-push hook and the CI type-check step stop being the slow part of the loop. It runs outside V8, so a large project can no longer hit the ~2 GB default heap and need a `NODE_OPTIONS=--max-old-space-size` escape hatch. Peak resident memory per process is unchanged, this is a latency and ceiling change, not a footprint one.

TypeScript 7 removes `baseUrl` (`error TS5102`), which is why `ignoreDeprecations: "6.0"` disappears with it: path mappings are resolved relative to the tsconfig that declares them, so the existing `paths` keep working on their own. `apps/api` drops its mapping entirely rather than keeping `paths` without `baseUrl`, because the Nest SWC builder copies `paths` from the tsconfig and passes an empty `jsc.baseUrl`, which panics the SWC binary at startup.

`typescript` stays a dependency: the Nest CLI, `react-router typegen`, Vite and the editor still use it.

## Applies When

- The project tracks the `tooling` domain.
- A `typecheck` or `build` script still calls `tsc`, or a tsconfig still sets `baseUrl`. Either one is the starting state this intention migrates away from, not a skip reason.

## Do Not Apply When

- The project pins a TypeScript feature that the native compiler does not implement yet (`tsgo` reports it as unsupported on the first run) and a human decided to wait.
- The build is not a workspace of tsconfig-driven packages (no `typecheck` script anywhere).

## Observable Gaps

1. **Catalog entry** — signal: `pnpm-workspace.yaml` has no `@typescript/native-preview` in the `build` catalog.
   Add it next to `typescript`, and declare `"@typescript/native-preview": "catalog:build"` as a devDependency of every package whose scripts call the compiler.
   Done when: `pnpm install` links `node_modules/.bin/tsgo`.

2. **Scripts** — signal: `rg '"(typecheck|build|dev)":.*\btsc\b' --glob package.json` returns anything.
   Replace `tsc` with `tsgo` in those scripts, keeping the flags (`--noEmit`, `-p tsconfig.json`, `--watch`).
   Done when: that search returns nothing and `pnpm -r run typecheck` passes.

3. **`baseUrl`** — signal: `rg baseUrl --glob 'tsconfig*.json'` returns anything.
   Delete the option (and the `ignoreDeprecations` that only existed to silence its TypeScript 6 deprecation). Keep `paths` as they are: they resolve relative to their own tsconfig. A tsconfig that had `baseUrl` and no `paths` needs none.
   Done when: `tsgo --noEmit` no longer reports `TS5102`.

4. **API path mapping** — signal: `apps/api/tsconfig.json` declares `paths`, or a source file imports from `src/…` instead of a relative path.
   Rewrite those imports relative and drop the mapping, so the Nest SWC builder receives no `paths`. The runtime alias used by the test runner (`resolve.alias` in `vitest.config.ts`) stays.
   Done when: `pnpm --filter api build` compiles with SWC without panicking, and `rg "from 'src/" apps/api/src` returns nothing.

5. **CI heap flag** — signal: the type-check job sets `NODE_OPTIONS: --max-old-space-size=…`.
   Remove it, the native compiler does not allocate on the V8 heap.
   Done when: the CI type-check step runs with no `NODE_OPTIONS`.

6. **Inference differences** — signal: `tsgo` reports `TS2769` (no overload matches) where `tsc` was silent, typically on a generic helper whose type argument is inferred from several properties at once, such as the AI SDK's `tool()`.
   Make the annotation the code was already implying rather than casting: in the CoinGecko example the `outputSchema` claimed `data` on a failure branch that returns `error` instead, and marking both optional types under either compiler.
   Done when: `tsc --noEmit` and `tsgo --noEmit` both pass on the file.

7. **Side-effect imports** — signal: `tsgo` reports `TS2882` on an extensionless import of an asset package (typically `@fontsource/*`).
   Import the file (`…/index.css`) so the bundler declaration for `*.css` applies, or keep an ambient `declare module` for it.
   Done when: `pnpm -r run typecheck` passes and the asset still lands in the client build.

## Out of Scope

- Removing `typescript` from the dependency tree, or the compiler used by `nest build`, `react-router typegen` and Vite.
- The editor language server.
- Rewriting `paths` mappings other than the API's `src/*`, and any application code the compiler does not reject.

## Reference Paths

- `pnpm-workspace.yaml` — **adapt**
- `tsconfig.base.json` — **adapt**
- `apps/api/tsconfig.json` — **adapt**
- `apps/api/package.json` — **adapt**
- `apps/web-spa/package.json` — **adapt**
- `apps/web-ssr/package.json` — **adapt**
- `packages/i18n/package.json` — **adapt**
- `.github/workflows/ci.yml` — **adapt**
- `apps/api/src/modules/example/ai-example/tools/coingecko.tools.ts` — **adapt**

## Validation

- `pnpm -r run typecheck` passes and prints `tsgo`.
- `pnpm -r build` succeeds, including the SWC build of the API.
- `pnpm -r test` is unchanged.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/adopt-tsgo --applied` after validation passes, or record it as skipped with a reason.
