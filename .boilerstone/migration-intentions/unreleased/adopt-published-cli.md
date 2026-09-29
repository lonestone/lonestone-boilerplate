---
id: unreleased/adopt-published-cli
domain: tooling
classification: migration
---

# Run the published @lonestone/cli through pnpm dlx

## Goal

The project runs `pnpm boilerplate` and `pnpm rock` through the published `@lonestone/cli`, called with `pnpm dlx`. The CLI is not a dependency of the project, and no CLI TypeScript is vendored under `.boilerstone/cli/` or `cli/setup.ts`.

## Why

Vendoring the upgrade CLI copied hundreds of lines of TypeScript (plus Vitest wiring the consumer never runs) into every generated project. Those sources go stale the moment the boilerplate ships a CLI fix. The CLI is now published as `@lonestone/cli`, and the project calls it with `pnpm dlx` instead of installing it: installing the project never depends on the Lonestone package, and detaching is just removing two scripts. `boilerplate` runs the latest CLI, because an upgrade is always done by the newest CLI. `rock` is pinned to the release the project tracks, so every developer gets the same local setup; `pnpm boilerplate upgrade finish` moves that pin forward. In generated projects, `.boilerstone/` stays state and docs only. There is no `install.sh`.

## Applies When

- The project tracks the `tooling` domain.
- Root `package.json` still has `"boilerplate": "tsx ./.boilerstone/cli/boilerplate.ts"` or `"rock": "tsx ./cli/setup.ts"`, or `.boilerstone/cli/` exists. That leftover vendored CLI is the starting state this intention migrates away from, not a skip reason.

## Do Not Apply When

- Both root scripts already call `pnpm dlx @lonestone/cli` and `.boilerstone/cli/` is absent.
- This is the Lonestone boilerplate repository itself. `.boilerstone/cli/` is the published package source there; do not delete it.
- The project has detached from Boilerstone (`rm -rf .boilerstone`) — record as skipped.
- A human has explicitly decided to keep a vendored CLI after reviewing this intention — record as skipped with that reason.

## Observable Gaps

1. **Root scripts** — signal: `"boilerplate"` or `"rock"` does not start with `pnpm dlx @lonestone/cli`.
   Set `"boilerplate": "pnpm dlx @lonestone/cli@latest"` and `"rock": "pnpm dlx @lonestone/cli@<target version> rock"`, where `<target version>` is the version this upgrade finishes at (without the `v`). Keep every other script. The published `rock` only sets up the local environment (`.env` files, ports, Docker, migrations): it never renames packages or deletes files. If `git log -- cli/setup.ts` shows commits made in this project (the file was customized), stop and ask the human before switching `rock`: those changes would be lost.
   Done when: `pnpm boilerplate --help` prints the Lonestone CLI usage.

2. **No CLI dependency** — signal: root `package.json` lists `@lonestone/cli` in `dependencies` or `devDependencies`.
   Remove it. Do not add `tsx` only to run the CLI.
   Done when: `rg '"@lonestone/cli":' package.json` returns nothing.

3. **Vendored CLI sources** — signal: `.boilerstone/cli/` or `cli/setup.ts` exists.
   Delete `.boilerstone/cli/`, `.boilerstone/package.json` / `tsconfig.json` / `vitest.config.ts` if present. Delete `cli/setup.ts` and `cli/utils.ts` only once gap 1 switched `rock`, and remove `cli/` if it is then empty. Remove the root `enquirer` devDependency only if nothing else imports it (`rg "from 'enquirer'" --glob '!node_modules'` returns nothing). Do not delete `.boilerstone/boilerplate.json`, the schema, or consumer docs.
   Done when: `test ! -e .boilerstone/cli && test ! -e cli/setup.ts && test ! -e cli/utils.ts`.

4. **Workspace membership** — signal: `pnpm-workspace.yaml` lists `.boilerstone` or `.boilerstone/cli`.
   Remove those entries. Leave `packages/*` and `apps/*`.
   Done when: `rg -n '^\s*-\s+\.boilerstone(/cli)?\s*$' pnpm-workspace.yaml` returns nothing.

5. **Lockfile** — signal: `pnpm-lock.yaml` still has a `.boilerstone` importer or an `@lonestone/cli` entry.
   Run `pnpm install`. Touch no other dependency ranges (beyond the `enquirer` removal in gap 3).
   Done when: `pnpm install --frozen-lockfile` succeeds and `rg '@lonestone/cli|\.boilerstone' pnpm-lock.yaml` returns nothing.

6. **Leftover installer script** — signal: `install.sh` exists at the project root.
   Delete it. New projects and upgrades go through `pnpm dlx @lonestone/cli` or `pnpm boilerplate`.
   Done when: `test ! -e install.sh`.

## Out of Scope

- Rewriting application code, routes, or env files.
- Re-running `pnpm rock`.
- Changing `boilerplate.json` intention outcomes.
- Publishing the npm package (producer-only).

## Reference Paths

- `.boilerstone/docs/how-it-works.md` — **copy**
- `.boilerstone/README.md` — **copy**

## Validation

- `pnpm boilerplate upgrade status` runs (it may still report missing release tags).
- `pnpm install --frozen-lockfile` and `pnpm typecheck` pass, or the project's equivalent filters.
- `rg "tsx \\./\\.boilerstone/cli|tsx \\./cli/setup" package.json` returns nothing.

## Record Result

`pnpm boilerplate upgrade record --id unreleased/adopt-published-cli --applied` (after promotion the id becomes `vX.Y.Z/adopt-published-cli`).
