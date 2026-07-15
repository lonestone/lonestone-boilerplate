---
id: v1.0.0/align-shared-dependency-versions
domain: tooling
classification: migration
requires:
  - v1.0.0/align-dependency-baseline
---

# Align Shared Dependency Versions

## Goal

Every dependency family the project shares with the boilerplate is either raised to the boilerplate's tested version set, or explicitly pinned older in the project's catalogs with a named reason.

## Why

The boilerplate's versions are a coherent constellation, tested together. Aligning older projects onto it is core maintenance value — but a bump is never just a JSON line, so this intention works **one catalog family at a time**, with validation and a commit per family, and an explicit escape hatch instead of unbounded fixing.

## Applies When

- The project tracks the `tooling` domain and has adopted the catalogs mechanism (`v1.0.0/align-dependency-baseline` applied first).
- At least one catalog family the project uses is behind the staged reference versions.

## Do Not Apply When

- The catalogs mechanism is not adopted yet — apply `v1.0.0/align-dependency-baseline` first.
- A family's upgrade is covered by its own intention (`@mikro-orm/*` belongs to `v1.0.0/migrate-mikro-orm-v7`) — skip that family here.

## Observable Gaps

Work **one catalog family at a time** (e.g. `frontend`, `auth`), in this loop; never mix families in one commit.

1. **Per family: raise or pin** — signal: the family's catalog entries are below the staged reference `pnpm-workspace.yaml` values.
   Raise the family's catalog entries to the reference values, run `pnpm install`, then `pnpm typecheck` and the project's tests. Apply **mechanical fixes only** (renamed imports/options, following that family's changelog). Commit as `chore: align <family> dependencies with boilerplate v1.0.0`.
   If the breakage goes beyond mechanical fixes: revert that family, keep its current version in the catalog with a `# pinned: <reason>` comment above the entries, and move on to the next family.
   Done when: the family is at reference versions with validations passing, or pinned with a named reason.

2. **Sweep check** — signal: a shared dependency escaped the catalogs (still pinned directly in an app `package.json`).
   Move it to its catalog family first, then it falls under gap 1.
   Done when: every dependency shared with the boilerplate resolves through a catalog.

## Out of Scope

- Dependencies the project added that the boilerplate does not ship.
- Rewriting app code beyond the mechanical fixes a family's changelog prescribes — deeper breakage means pin-and-name, not a refactor.
- Families owned by another intention (MikroORM).

## Reference Paths

- `pnpm-workspace.yaml` — **adapt**
- `package.json` — **adapt**
- `apps/api/package.json` — **adapt**

## Validation

- `pnpm install`, `pnpm typecheck` and existing tests pass after each family commit.
- Every shared family is at reference versions or carries a `# pinned: <reason>` comment in `pnpm-workspace.yaml`.
- The PR summary lists each family: aligned or pinned (with reason).

## Record Result

Run `pnpm boilerplate upgrade record --id v1.0.0/align-shared-dependency-versions --applied` once every shared family is aligned or explicitly pinned, or record it as skipped with a reason.
