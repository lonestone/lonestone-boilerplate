---
id: v1.0.0/align-dependency-baseline
domain: tooling
classification: migration
---

# Align Dependency Baseline

## Goal

The project's dependency _plumbing_ matches the v1.0.0 boilerplate: `engines`/`packageManager` pins and the pnpm catalogs mechanism. This intention changes **no dependency version** except the toolchain itself.

## Why

Future releases ship dependency changes as catalog diffs — adopting the mechanism now makes every later upgrade a small, reviewable hunk in one file. Version bumps themselves are deliberately **not** covered here: raising shared families to the boilerplate's tested version set is its own protocol, `v1.0.0/align-shared-dependency-versions` (one catalog family at a time), and framework migrations ship inside their owning intention (`v1.0.0/migrate-mikro-orm-v7` bumps `@mikro-orm/*`).

## Applies When

- The project tracks the `tooling` domain and uses pnpm workspaces.
- Root `package.json` `engines`/`packageManager` differ from the staged reference, or `pnpm-workspace.yaml` has no `catalogs:` section.

## Do Not Apply When

- The project intentionally pins different engine versions (CI or hosting constraint) — record as skipped with that reason.
- The project does not use pnpm workspaces (stop and ask; converting the workspace layout is not covered here).

## Observable Gaps

`package.json` and `pnpm-workspace.yaml` are always **merges, never copies**: the project's own dependencies are interleaved with the boilerplate's. Treat each dependency line as its own hunk.

1. **Toolchain pins** — signal: root `package.json` `engines` or `packageManager` differ from the staged reference `package.json`.
   Copy the reference values for `engines.node`, `engines.pnpm` and `packageManager` only. If the project's runtime or CI cannot move to the pinned Node yet, record this intention as skipped with that reason instead of half-applying it.
   Done when: `pnpm install` runs under the pinned pnpm without engine warnings.

2. **Catalogs mechanism** — signal: `pnpm-workspace.yaml` has no `catalogs:` section while apps pin shared dependencies directly.
   Copy the `catalogs:` structure from the staged reference, keep only the entries for dependencies the project actually uses, and set each entry to the version the project **currently uses** — not the boilerplate's. Then switch the matching app `package.json` entries to `catalog:<name>`. Zero version changes; `pnpm-lock.yaml` should be unchanged apart from formatting.
   Done when: `pnpm install` succeeds, the app builds, and no dependency resolved to a different version than before (compare the lockfile).

## Out of Scope

- **Any dependency version bump.** Raising shared families to the boilerplate versions is `v1.0.0/align-shared-dependency-versions`; framework migrations ship inside their owning intention.
- Dependencies the project added that the boilerplate does not ship.
- Converting a non-pnpm project to pnpm workspaces.

## Reference Paths

- `package.json` — **adapt**
- `pnpm-workspace.yaml` — **adapt**

## Validation

- `pnpm install` completes without engine warnings.
- No dependency resolves to a different version than before this intention (lockfile diff is formatting-only).
- `pnpm typecheck` passes.

## Record Result

Run `pnpm boilerplate upgrade record --id v1.0.0/align-dependency-baseline --applied` after validation passes, or record it as skipped with a reason.
