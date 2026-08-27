---
id: unreleased/rewrite-workspace-scope-imports
domain: tooling
classification: migration
pr: 146
---

# Rewrite leftover @boilerstone imports

## Goal

After a project rename, workspace imports, tsconfig paths, shadcn aliases, docs, and CI filters use `@<project>/ui`, `@<project>/openapi-generator`, and `@<project>/i18n` — not `@boilerstone/`.

## Why

`pnpm rock` already renamed `package.json` names and dependency keys, but it left `@boilerstone/` in source, docs, and config. Vite then could not resolve `@boilerstone/ui` (and the other workspace packages) because those package names no longer existed. A tree-wide replace of the old scope, with a skip list for `.boilerstone/`, the changelog, and lockfiles, is the smallest way to keep every remaining reference in sync. Re-running `pnpm rock` is not the fix: it also rewrites env and docker files.

## Applies When

- The project tracks the `tooling` domain.
- Workspace packages were renamed away from `@boilerstone/*` (for example `packages/ui/package.json` `"name"` is not `@boilerstone/ui`).
- `apps/` or `packages/` still contain `@boilerstone/ui`, `@boilerstone/openapi-generator`, or `@boilerstone/i18n`. Still having those leftovers is the starting state this intention migrates away from, not a skip reason.

## Do Not Apply When

- The project still uses `@boilerstone` as its npm scope — record as skipped.
- Those leftovers are already gone under `apps/` and `packages/`.
- A human has explicitly decided to keep mixed scopes after reviewing this intention — record as skipped with that reason.

## Observable Gaps

1. **Frontend imports** — signal: `apps/web-spa` or `apps/web-ssr` still import `@boilerstone/ui`, `@boilerstone/openapi-generator`, or `@boilerstone/i18n`.
   Read the current scope from `packages/ui/package.json` `"name"` (`@acme/ui` → `@acme`). Replace `@boilerstone/` with that scope in those apps. Do not touch `.boilerstone/`.
   Done when: `rg "@boilerstone/(ui|openapi-generator|i18n)" apps/web-spa apps/web-ssr` returns nothing.

2. **UI package self-references** — signal: `packages/ui` still imports `@boilerstone/ui`, or `packages/ui/tsconfig.json` / `packages/ui/components.json` still use that prefix.
   Apply the same replace in `packages/ui`. Leave component implementations alone beyond the import/alias strings.
   Done when: `rg "@boilerstone/" packages/ui` returns nothing.

3. **i18n and OpenAPI package docs** — signal: `packages/i18n/README.md` or `packages/openapi-generator/README.md` still mention `@boilerstone/i18n` or `@boilerstone/openapi-generator`.
   Adapt the scoped names from the staged references. Do not rewrite API usage examples beyond the package prefix.
   Done when: those READMEs use the project's scope.

4. **Documentation and CI** — signal: `apps/documentation` still cites `@boilerstone/ui` (or the other two packages), or `.github/workflows/ci.yml` still runs `pnpm --filter @boilerstone/i18n`.
   Apply the same replace. Keep `.boilerstone/` and `CHANGELOG.md` unchanged.
   Done when: `rg "@boilerstone/(ui|openapi-generator|i18n)" apps/documentation .github` returns nothing.

5. **TypeScript path map** — signal: `tsconfig.base.json` still maps `"@boilerstone/*"`.
   Rename that path key to the project's scope. Do not change the `packages/*/src` target.
   Done when: the path key matches `@<project>/*`.

## Out of Scope

- Re-running `pnpm rock`.
- `.boilerstone/` (the upgrade CLI stays `@boilerstone/boilerplate`).
- `CHANGELOG.md` and lockfiles.
- Root package name, docker-compose service names, and env files — those were already handled by rock.

## Reference Paths

- `cli/setup.ts` — **adapt**
- `packages/ui/tsconfig.json` — **adapt**
- `packages/ui/components.json` — **adapt**
- `tsconfig.base.json` — **adapt**
- `apps/documentation/src/content/docs/references/frontend.mdx` — **adapt**
- `.github/workflows/ci.yml` — **adapt**

## Validation

- `rg "@boilerstone/(ui|openapi-generator|i18n)" apps packages --glob '!**/node_modules/**'` returns nothing.
- `pnpm install` succeeds so the lockfile matches the renamed workspace packages.
- `pnpm --filter=web-spa typecheck` and `pnpm --filter=web-ssr typecheck` pass when those apps exist (or the project's equivalent filters).

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/rewrite-workspace-scope-imports --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
