---
id: v1.0.0/standardize-oxlint-oxfmt
domain: tooling
classification: migration
---

# Standardize Oxlint And Oxfmt

## Goal

Align an older consumer project with the v1.0.0 lint and format baseline using `oxlint` and `oxfmt`.

## Why

The v1.0.0 boilerplate standardizes fast static checks and formatting around Oxlint and Oxfmt. Projects created before this baseline may still use another lint/format stack or incomplete scripts, which makes future boilerplate changes harder to validate consistently.

## Applies When

- The project wants to follow the boilerplate tooling domain.
- The root `package.json` does not expose the v1.0.0 `lint`, `lint:fix`, `fmt`, and `fmt:check` scripts.
- The project does not intentionally use a custom lint/format stack.

## Do Not Apply When

- The project intentionally standardized on another formatter or linter.
- The project has custom lint rules that cannot be represented by the boilerplate baseline without a human decision.
- The project does not track the `tooling` domain.

## Reference Paths

- `package.json`
- `pnpm-lock.yaml`
- `.oxlintrc.json` or equivalent Oxlint configuration when present in the target reference

## Suggested Agent Workflow

1. Compare the project's root `package.json` scripts and dev dependencies with the v1.0.0 reference.
2. Add or align the missing Oxlint/Oxfmt scripts with the smallest package.json change.
3. Add missing dev dependencies only when the project does not already provide equivalent tooling.
4. Preserve project-specific scripts and custom lint commands.
5. Run formatting only if required to satisfy the new formatter; avoid cosmetic rewrites unrelated to the tooling migration.

## Validation

- `pnpm install` completes if dependencies changed.
- `pnpm lint` runs.
- `pnpm fmt:check` runs.

## Record Result

Run `pnpm boilerplate upgrade record --id v1.0.0/standardize-oxlint-oxfmt --applied` after validation passes, or record it as skipped with a reason.
