---
id: unreleased/adopt-published-cli
domain: tooling
classification: migration
---

# Adopt the published @lonestone/cli package

## Goal

The project runs `pnpm boilerplate` and `pnpm rock` through the published `@lonestone/cli` package. It does not vendor CLI TypeScript under `.boilerstone/cli/` or `cli/setup.ts`.

## Why

Vendoring the upgrade CLI copied hundreds of lines of TypeScript (plus Vitest wiring the consumer never runs) into every generated project. Those sources go stale the moment the boilerplate ships a CLI fix. Publishing `@lonestone/cli` lets consumers take CLI fixes with a dependency bump. Init, onboard, rock, and upgrade all live in that package. In generated projects, `.boilerstone/` stays state and docs only. There is no `install.sh`. The CLI sources live in the boilerplate repo under `.boilerstone/cli/` and are stripped on generate.

## Applies When

- The project tracks the `tooling` domain.
- Root `package.json` still has `"boilerplate": "tsx ./.boilerstone/cli/boilerplate.ts"` or `"rock": "tsx ./cli/setup.ts"`, or `.boilerstone/cli/` exists. That leftover vendored CLI is the starting state this intention migrates away from, not a skip reason.

## Do Not Apply When

- `@lonestone/cli` is already a dependency and `.boilerstone/cli/` is absent.
- This is the Lonestone boilerplate repository itself. `.boilerstone/cli/` is the published package source there; do not delete it.
- The project has detached from Boilerstone (`rm -rf .boilerstone`) — record as skipped.
- A human has explicitly decided to keep a vendored CLI after reviewing this intention — record as skipped with that reason.

## Observable Gaps

1. **Published CLI dependency** — signal: root `package.json` has no `@lonestone/cli` (or it is `workspace:*` in a consumer).
   Add `"@lonestone/cli": "^<boilerplate-version>"` to `devDependencies`. Do not add `tsx` only to run the CLI.
   Done when: `rg '"@lonestone/cli"' package.json` matches a semver range, not `workspace:*`.

2. **Root scripts** — signal: `"boilerplate"` is not `lonestone`, or `"rock"` is still `tsx ./cli/setup.ts`.
   Set `"boilerplate": "lonestone"` and `"rock": "lonestone rock"`. Keep every other script.
   Done when: `pnpm boilerplate --help` prints the Lonestone CLI usage.

3. **Vendored CLI sources** — signal: `.boilerstone/cli/` or `cli/setup.ts` exists.
   Delete `.boilerstone/cli/`, `cli/setup.ts`, `cli/utils.ts`, and `.boilerstone/package.json` / `tsconfig.json` / `vitest.config.ts` if present. Do not delete `.boilerstone/boilerplate.json`, the schema, or consumer docs.
   Done when: `test ! -e .boilerstone/cli && test ! -e cli/setup.ts`.

4. **Workspace membership** — signal: `pnpm-workspace.yaml` lists `.boilerstone` or `.boilerstone/cli`.
   Remove those entries. Leave `packages/*` and `apps/*`. Do not add `.boilerstone/cli` in a consumer.
   Done when: `rg -n '^\s*-\s+\.boilerstone(/cli)?\s*$' pnpm-workspace.yaml` returns nothing.

5. **Lockfile** — signal: `pnpm-lock.yaml` has no `@lonestone/cli`.
   Run `pnpm install`. Touch no other dependency ranges.
   Done when: `pnpm why @lonestone/cli` resolves.

6. **Leftover installer script** — signal: `install.sh` exists at the project root.
   Delete it. New projects and upgrades go through `pnpm dlx @lonestone/cli` or `pnpm boilerplate`.
   Done when: `test ! -e install.sh`.

## Out of Scope

- Rewriting application code, routes, or env files.
- Re-running `pnpm rock`.
- Changing `boilerplate.json` intention outcomes.
- Publishing the npm package (producer-only).

## Reference Paths

- `package.json` — **adapt**
- `pnpm-workspace.yaml` — **adapt**

## Validation

- `pnpm boilerplate upgrade status` runs (it may still report missing release tags).
- `pnpm typecheck` passes, or the project's equivalent filters.
- `rg "tsx \\./\\.boilerstone/cli" package.json` returns nothing.

## Record Result

`pnpm boilerplate upgrade record --id unreleased/adopt-published-cli --applied` (after promotion the id becomes `vX.Y.Z/adopt-published-cli`).
