---
id: v1.0.0/align-dependency-baseline
domain: tooling
classification: migration
---

# Align Dependency Baseline

## Goal

The project's toolchain pins and shared dependency versions match the v1.0.0 boilerplate: `engines`/`packageManager`, pnpm dependency catalogs, and the versions of dependencies the project shares with the boilerplate.

## Why

Later intentions and their validations assume the v1.0.0 toolchain (Node, pnpm, TypeScript-era packages). A project running far behind fails those validations for reasons unrelated to the intention being applied. Catalogs (`pnpm-workspace.yaml`) also become the boilerplate's mechanism for versioning shared dependencies — future releases update catalogs, so adopting them now makes every later upgrade smaller.

## Applies When

- The project tracks the `tooling` domain and uses pnpm workspaces.
- Root `package.json` `engines`/`packageManager` differ from the staged reference, or `pnpm-workspace.yaml` has no `catalogs:` section.

## Do Not Apply When

- The project intentionally pins different engine versions (CI or hosting constraint) — record as skipped with that reason.
- The project does not use pnpm workspaces (stop and ask; converting the workspace layout is not covered here).

## Observable Gaps

Work through each gap independently; skip any that is already closed.

1. **Toolchain pins** — signal: root `package.json` `engines` or `packageManager` differ from the staged reference `package.json`.
   Copy the reference values verbatim (`engines.node`, `engines.pnpm`, `packageManager`).
   Done when: `pnpm install` runs under the pinned pnpm without engine warnings.

2. **Dependency catalogs** — signal: `pnpm-workspace.yaml` has no `catalogs:` section, or apps pin versions directly for dependencies the boilerplate resolves via `catalog:`.
   Copy the `catalogs:` section from the staged reference `pnpm-workspace.yaml`, then switch to `catalog:<name>` **only the dependencies the project already uses**. Do not add catalog entries for packages the project does not depend on.
   Done when: `pnpm install` succeeds and shared dependencies resolve through catalogs.

3. **Shared dependency versions** — signal: a dependency present in **both** the project and the staged reference (root devDependencies like `tsx`, `husky`, `knip`, or app dependencies covered by a catalog) is behind the reference version.
   Align only those shared versions to the reference. One `pnpm install`, then fix only the breakages that alignment itself causes.
   Done when: `pnpm install`, `pnpm typecheck` and existing tests pass.

## Out of Scope

- Dependencies the project added that the boilerplate does not ship — never touched, never upgraded.
- Version bumps beyond what the reference pins.
- Framework migrations that have their own intention (MikroORM v7 is `v1.0.0/migrate-mikro-orm-v7`, lint/format is `v1.0.0/standardize-oxlint-oxfmt`).
- Converting a non-pnpm project to pnpm workspaces.

## Reference Paths

- `package.json`
- `pnpm-workspace.yaml`
- `apps/api/package.json`

## Validation

- `pnpm install` completes.
- `pnpm typecheck` passes.
- Existing tests pass, or are reported unavailable.

## Record Result

Run `pnpm boilerplate upgrade record --id v1.0.0/align-dependency-baseline --applied` after validation passes, or record it as skipped with a reason.
