---
id: unreleased/adopt-typescript-7
domain: tooling
classification: migration
pr: 151
---

# Type-check and build with TypeScript 7

## Goal

The `build` catalog pins `typescript` to `^7.0.2`, every `typecheck` and `tsc` build script runs that compiler, and no tsconfig sets `baseUrl` or `ignoreDeprecations`. `apps/api` is the exception: it keeps a local `typescript@^6` for the Nest CLI and reaches the 7.x binary from the workspace root.

## Why

TypeScript 7 is the native port of the compiler, shipped on the `latest` npm tag. Its `tsc` is the Go binary, so no separate package is needed: `@typescript/native-preview` (`tsgo`) was only the preview channel and is frozen on `7.0.0-dev.20260707.2`.

On this repository `apps/api` type-checks in about 1.1s instead of 4.7s, and the whole workspace in about 2s, so the pre-push hook and the CI type-check step stop being the slow part of the loop. The compiler runs outside V8, so a large project can no longer hit the ~2 GB default heap and need a `NODE_OPTIONS=--max-old-space-size` escape hatch. Peak resident memory per process is unchanged, this is a latency and ceiling change, not a footprint one.

TypeScript 7.0 ships the `tsc` executable only. The programmatic compiler API (`ts.getParsedCommandLineOfConfigFile` and friends) is gone and is expected back in 7.1. The Nest CLI loads that API with `require.resolve('typescript', { paths: [process.cwd(), …] })` and refuses to start without it, which breaks both `nest build` and `nest start --watch`. That is why `apps/api` still declares `typescript@^6.0.3`: the Nest CLI resolves 6.x from the package, while the package's `typecheck` script runs the root 7.x binary through `pnpm -w exec`. Once the API returns in TypeScript 7.1 and `@nestjs/cli` accepts it, that pin and that script can go back to a plain `typescript: catalog:build` and `tsc --noEmit`.

TypeScript 7 removes `baseUrl` (`error TS5102`), which is why `ignoreDeprecations: "6.0"` disappears with it: path mappings resolve relative to the tsconfig that declares them, so the existing `paths` keep working on their own. `apps/api` drops its mapping entirely rather than keeping `paths` without `baseUrl`, because the Nest SWC builder copies `paths` from the tsconfig and passes an empty `jsc.baseUrl`, which panics the SWC binary at startup.

## Applies When

- The project tracks the `tooling` domain.
- A `typecheck` or `build` script still calls a TypeScript 5 or 6 `tsc`, or a tsconfig still sets `baseUrl`. Either one is the starting state this intention migrates away from, not a skip reason.

## Do Not Apply When

- The project pins a TypeScript feature that the native compiler does not implement yet (7.x reports it as unsupported on the first run) and a human decided to wait.
- The build is not a workspace of tsconfig-driven packages (no `typecheck` script anywhere).

## Observable Gaps

1. **Catalog version** — signal: the `build` catalog pins `typescript` below 7, or still lists `@typescript/native-preview`.
   Set `typescript: ^7.0.2` and delete the `@typescript/native-preview` entry along with every `"@typescript/native-preview": "catalog:build"` devDependency. Bump `peerDependencyRules.allowedVersions.typescript` to `'7'` so `tsconfck` (via `vite-tsconfig-paths`) keeps resolving.
   Done when: `pnpm install` succeeds and `node_modules/.bin/tsc --version` prints 7.x.

2. **Scripts** — signal: `rg '"(typecheck|build|dev)":.*\btsgo\b' --glob package.json` returns anything.
   Replace `tsgo` with `tsc`, keeping the flags (`--noEmit`, `-p tsconfig.json`, `--watch`). A package that had `@typescript/native-preview` but no `typescript` needs `"typescript": "catalog:build"` added.
   Done when: that search returns nothing and `pnpm -r run typecheck` passes.

3. **Packages that need the compiler API** — signal: `nest build` or `nest start` fails with `The installed TypeScript version (7.x) does not expose the programmatic compiler API that the Nest CLI requires`. The same applies to any tool that calls `require('typescript')` for more than its version.
   Declare `"typescript": "^6.0.3"` in that package so the tool resolves 6.x from the package directory, and point its `typecheck` script at the root 7.x binary: `pnpm -w exec tsc --noEmit -p <path>/tsconfig.json`.
   Done when: `pnpm --filter <pkg> build` succeeds and that package's `typecheck` still runs the 7.x compiler.

4. **`baseUrl`** — signal: `rg baseUrl --glob 'tsconfig*.json'` returns anything.
   Delete the option (and the `ignoreDeprecations` that only existed to silence its TypeScript 6 deprecation). Keep `paths` as they are: they resolve relative to their own tsconfig. A tsconfig that had `baseUrl` and no `paths` needs none.
   Done when: `tsc --noEmit` no longer reports `TS5102`.

5. **API path mapping** — signal: `apps/api/tsconfig.json` declares `paths`, or a source file imports from `src/…` instead of a relative path.
   Rewrite those imports relative and drop the mapping, so the Nest SWC builder receives no `paths`. The runtime alias used by the test runner (`resolve.alias` in `vitest.config.ts`) stays.
   Done when: `pnpm --filter api build` compiles with SWC without panicking, and `rg "from 'src/" apps/api/src` returns nothing.

6. **CI heap flag** — signal: the type-check job sets `NODE_OPTIONS: --max-old-space-size=…`.
   Remove it, the native compiler does not allocate on the V8 heap.
   Done when: the CI type-check step runs with no `NODE_OPTIONS`.

7. **Inference differences** — signal: the 7.x compiler reports `TS2769` (no overload matches) where 5.x/6.x was silent, typically on a generic helper whose type argument is inferred from several properties at once, such as the AI SDK's `tool()`.
   Make the annotation the code was already implying rather than casting: in the CoinGecko example the `outputSchema` claimed `data` on a failure branch that returns `error` instead, and marking both optional types under either compiler.
   Done when: the file passes under both the old and the new compiler.

8. **Side-effect imports** — signal: the 7.x compiler reports `TS2882` on an extensionless import of an asset package (typically `@fontsource/*`).
   Import the file (`…/index.css`) so the bundler declaration for `*.css` applies, or keep an ambient `declare module` for it.
   Done when: `pnpm -r run typecheck` passes and the asset still lands in the client build.

## Out of Scope

- Removing the Nest CLI from the API build or dev loop.
- The editor language server.
- Rewriting `paths` mappings other than the API's `src/*`, and any application code the compiler does not reject.

## Reference Paths

- `pnpm-workspace.yaml` — **adapt**
- `package.json` — **adapt**
- `tsconfig.base.json` — **adapt**
- `apps/api/tsconfig.json` — **adapt**
- `apps/api/package.json` — **adapt**
- `apps/web-spa/package.json` — **adapt**
- `apps/web-ssr/package.json` — **adapt**
- `packages/i18n/package.json` — **adapt**
- `.boilerstone/package.json` — **adapt**
- `.github/workflows/ci.yml` — **adapt**
- `apps/api/src/modules/example/ai-example/tools/coingecko.tools.ts` — **adapt**

## Validation

- `pnpm -r run typecheck` passes.
- `pnpm -r build` succeeds, including the SWC build of the API.
- `pnpm -r test` is unchanged.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/adopt-typescript-7 --applied` after validation passes, or record it as skipped with a reason.
