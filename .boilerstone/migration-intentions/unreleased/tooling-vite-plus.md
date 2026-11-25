---
id: unreleased/tooling-vite-plus
domain: tooling
classification: migration
requires:
  - unreleased/api-nestjs-12-esm
---

# Run format, lint, type checks, tests and builds through Vite+

## Goal

Every package formats, lints, type-checks, tests and builds through Vite+ (`vp`). One root `vite.config.ts` holds the lint and format config. The root scripts `pnpm check`, `pnpm fmt`, `pnpm test` and `pnpm build` are the entry points.

## Why

Developers and agents should run the same few commands everywhere and read one config. Before, oxlint, oxfmt, each package's `tsc` run and each tool's config file were separate. Vite+ bundles Vite, Vitest, Oxlint, Oxfmt, a type checker and a task runner behind one CLI, and the stack already used all of them except the CLI. After `unreleased/api-nestjs-12-esm`, every app builds with Vite.

`pnpm check` runs format, lint and type checks of every package in one pass. Each package is type-checked against its own `tsconfig.json`, so no package keeps a `typecheck` script. The React Router route types are generated first. The pre-push hook runs `vp run --cache check`, which replays the last result when no input changed.

Vite+ pins Vitest 5, so the workspace moves to Vitest 5. Inline Vitest projects now inherit the root config. Its type checker (tsrs) rejects `baseUrl`, so the tsconfigs drop it.

lefthook stays the only hook manager. Vite+ documents only a pre-commit hook, and the project needs `commit-msg` for commitlint. The type-aware lint rules that the type check turns on are off: they fire on existing code, and enabling them is a separate cleanup.

The API keeps `unplugin-swc` and `vite-node`. Oxc can emit decorator metadata, but it writes `Object` for types imported from another file, and Nest's dependency injection reads those types.

## Applies When

- The root `package.json` runs `oxlint` or `oxfmt`, or the root has `.oxlintrc.json` or `.oxfmtrc.json`.
- `unreleased/api-nestjs-12-esm` is applied or skipped (the API, when present, builds with Vite).

## Do Not Apply When

- The project replaced Oxlint or Oxfmt with ESLint, Prettier or Biome on purpose. Stop and ask.
- A package depends on a Vite plugin whose `vite` peer excludes Vite 8 (check `npm view <plugin> peerDependencies`). Stop and list it.
- A human reviewed this intention and decided to keep the separate tools. Record as skipped with that reason.

## Observable Gaps

1. **Vitest 5** — signal: `vitest` below 5 in any `package.json`.
   Point `vitest` and `@vitest/coverage-v8` at the `build` catalog of the staged `pnpm-workspace.yaml` (the version Vite+ ships). Move `vite-node` to 6. In the API `vite.config.ts`, remove what each inline project repeats from the root config (`plugins`, `resolve.alias`, `globals`, `environment`).
   Done when: `pnpm test` passes.
2. **No `baseUrl`** — signal: `"baseUrl"` in any `tsconfig*.json`.
   Remove `baseUrl` and the `ignoreDeprecations` set for it. Keep every alias in `paths`, written relative to its tsconfig (`./src/*`).
   Done when: no tsconfig has `baseUrl` and `pnpm check` reports no tsconfig error.
3. **Vite+ dependency and Vite alias** — signal: no `vite-plus` in the root `package.json`, or the `vite` catalog entry is not `npm:@voidzero-dev/vite-plus-core@…`.
   Align `pnpm-workspace.yaml` (`build` catalog and the `vite@*` / `vitest@*` overrides) and the `vite-plus` devDependencies with the staged reference. Remove `oxlint`, `oxfmt` and `ts-node`. Imports from `vitest`, `vitest/config` and `vite` become `vite-plus/test` and `vite-plus` (a lint rule flags the rest).
   Done when: `pnpm install` passes with `strictPeerDependencies` and `pnpm exec vp --version` lists `vite-plus`.
4. **One root config** — signal: `.oxlintrc.json` or `.oxfmtrc.json` exists at the root.
   Move their content into the `lint` and `fmt` blocks of the root `vite.config.ts`, keep the project's own rules and ignore patterns, then delete both files. Add the `options` (`typeAware`, `typeCheck`) and the rules turned off in the staged file.
   Done when: both files are gone and `pnpm check` reports 0 errors.
5. **Scripts and hooks** — signal: the root `package.json` still has `lint`, `fmt:check` or `typecheck`, or `lefthook.yml` runs `oxfmt` or `pnpm typecheck`.
   Align the root scripts, the web apps' `typegen` script and `lefthook.yml` with the staged reference. Remove every package's `typecheck` script.
   Done when: `pnpm check` passes and a pre-push runs `vp run --cache check`.
6. **CI and editors** — signal: `.github/workflows/ci.yml` runs `pnpm lint`, `pnpm fmt:check` or `typecheck`.
   Replace them with the single `check` job of the staged workflow. If branch protection requires `Lint` or `Type Check`, require `Check` instead. Align `.vscode/` and `.zed/settings.json`.
   Done when: CI is green on the migration branch.

## Out of Scope

- The 33 existing lint warnings and the type-aware rules turned off in `vite.config.ts`: enabling them is a separate cleanup.
- `packages/ui` components: only its `tsconfig.json` loses `baseUrl`.
- The API build, dev and test setup beyond the Vitest 5 project cleanup (`unplugin-swc`, `vite-node` stay).
- The documentation app's scripts: Astro keeps its own CLI.
- Cross-run CI task caching: Vite+ marks it experimental.

## Reference Paths

- `vite.config.ts` — **adapt**
- `package.json` — **adapt**
- `pnpm-workspace.yaml` — **adapt**
- `lefthook.yml` — **copy**
- `.github/workflows/ci.yml` — **adapt**
- `apps/api/vite.config.ts` — **adapt**
- `apps/api/package.json` — **adapt**
- `apps/web-spa/package.json` — **adapt**
- `apps/web-ssr/package.json` — **adapt**
- `tsconfig.base.json` — **adapt**
- `.vscode/settings.json` — **adapt**
- `.zed/settings.json` — **adapt**

## Validation

- `pnpm install` passes.
- `pnpm check` reports 0 errors.
- `pnpm test` passes.
- `NODE_ENV=production pnpm build` builds every package, the documentation included.
- The API starts with `pnpm --filter=api dev`, and `pnpm --filter=api db:migrate:up` applies migrations.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/tooling-vite-plus --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
