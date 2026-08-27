---
id: v1.1.0/adopt-typescript-6
domain: tooling
classification: migration
---

# Adopt TypeScript 6

## Goal

The project compiles with TypeScript 6.0.x, sets `ignoreDeprecations: "6.0"` wherever `baseUrl` is used, and allows `typescript@6` through pnpm peer-dependency rules.

## Why

The next boilerplate release moves the compiler baseline from TypeScript 5.9 to 6.0.3. TypeScript 6 deprecates `baseUrl`; without `ignoreDeprecations: "6.0"` and a pnpm allowance for `typescript@6`, `pnpm typecheck` and installs fail even when the rest of the catalog is unchanged.

## Applies When

- The project tracks the `tooling` domain.
- Root or `catalog:build` `typescript` is below 6, or a tsconfig that sets `baseUrl` lacks `ignoreDeprecations: "6.0"`, or `pnpm-workspace.yaml` has no `peerDependencyRules.allowedVersions.typescript: '6'`.

## Do Not Apply When

- A human has explicitly decided to stay on TypeScript 5 after reviewing this intention — record as skipped with that reason. Still being on TypeScript 5 is **not** a skip condition.
- The project does not use TypeScript.

## Observable Gaps

1. **Compiler version** — signal: root `package.json` or `pnpm-workspace.yaml` `catalogs.build.typescript` is `^5` (or otherwise below 6.0.3).
   Align only the `typescript` entries with the staged reference `package.json` and `pnpm-workspace.yaml`. Do not bump other catalog families here.
   Done when: `pnpm install` resolves `typescript@6` and `pnpm typecheck` runs (findings in later gaps).

2. **`ignoreDeprecations`** — signal: a tsconfig that sets `compilerOptions.baseUrl` has no `"ignoreDeprecations": "6.0"`.
   Add the flag next to `baseUrl` in those files, matching staged `tsconfig.base.json` and `apps/api/tsconfig.json`. Leave unrelated compiler options untouched.
   Done when: `tsc` no longer reports `baseUrl` deprecation.

3. **Peer dependency allowance** — signal: `pnpm-workspace.yaml` lacks `peerDependencyRules.allowedVersions.typescript: '6'`.
   Copy that block from the staged reference (tsconfck / vite-tsconfig-paths still declare `typescript@^5`).
   Done when: `pnpm install` completes without a typescript peer conflict.

4. **Font CSS ambient module (SPA)** — signal: the SPA imports `@fontsource/source-sans-pro` and `tsc` reports a missing module declaration.
   Add `declare module '@fontsource/source-sans-pro'` in the staged reference `apps/web-spa/app/env.d.ts` (or the project's equivalent env/types file).
   Done when: SPA `typecheck` no longer fails on that import.

5. **i18n CLI script** — signal: `packages/i18n` typecheck includes `src/i18n-sync.ts` and fails under TypeScript 6.
   Exclude `src/i18n-sync.ts` from that package's `tsconfig.json` the same way the staged reference does.
   Done when: `pnpm --filter=@boilerstone/i18n typecheck` passes.

## Out of Scope

- Other catalog families (`frontend`, `auth`, remaining `build` entries) — those are `unreleased/align-shared-dependency-versions`.
- React Router package bumps and `loaderData` — those are `unreleased/migrate-react-router-8`.
- Non-catalog app dependency bumps (NestJS, Sentry, AI SDK, and similar).
- Rewriting application code to remove `baseUrl` instead of setting `ignoreDeprecations`.

## Reference Paths

- `package.json` — **adapt**
- `pnpm-workspace.yaml` — **adapt**
- `tsconfig.base.json` — **adapt**
- `apps/api/tsconfig.json` — **adapt**
- `apps/web-spa/app/env.d.ts` — **adapt**
- `packages/i18n/tsconfig.json` — **adapt**

## Validation

- `pnpm install` completes without a typescript peer conflict.
- `pnpm typecheck` passes.
- `pnpm --filter=@boilerstone/i18n typecheck` passes when that package exists.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/adopt-typescript-6 --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
