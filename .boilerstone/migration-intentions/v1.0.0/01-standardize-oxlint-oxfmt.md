---
id: v1.0.0/standardize-oxlint-oxfmt
domain: tooling
classification: migration
---

# Standardize Oxlint And Oxfmt

## Goal

The project lints with `oxlint` and formats with `oxfmt`, exposed through the root `lint`, `lint:fix`, `fmt`, and `fmt:check` scripts.

## Why

The v1.0.0 boilerplate standardizes fast static checks and formatting on Oxlint and Oxfmt. Projects on another stack (or with incomplete scripts) cannot validate future boilerplate changes consistently — every later intention's validation step assumes these four scripts exist.

## Applies When

- The project tracks the `tooling` domain.
- The root `package.json` does not expose the v1.0.0 `lint`, `lint:fix`, `fmt`, and `fmt:check` scripts backed by oxlint/oxfmt — including projects still on ESLint, Prettier, Biome, or another stack. That prior stack is the normal starting state this intention migrates away from.

## Do Not Apply When

- A human has explicitly decided to keep another linter/formatter after reviewing this intention — record as skipped with that reason. Still using ESLint/Prettier/Biome (or incomplete scripts) is **not** a skip condition.
- The project has custom lint rules that cannot be mapped to the Oxlint baseline without a human decision (stop and ask).

## Observable Gaps

Work through each gap independently; skip any that is already closed.

1. **Scripts** — signal: the root `package.json` lacks `lint`, `lint:fix`, `fmt`, or `fmt:check`, or they point to another tool.
   Align the four scripts with the staged reference `package.json`. Keep every project-specific script untouched.
   Done when: the four scripts exist and invoke oxlint/oxfmt.

2. **Dev dependencies** — signal: `oxlint` or `oxfmt` missing from the root `devDependencies`.
   Add them at the versions in the staged reference. Remove the superseded linter/formatter packages only when nothing else in the project references them; otherwise leave them and note it in the PR summary.
   Done when: `pnpm install` completes.

3. **Config files** — signal: no `.oxlintrc.json` or `.oxfmtrc.json` at the project root.
   Copy the staged reference files verbatim, then port the project's own rule intent from the old config. If a rule cannot be mapped, stop and ask rather than silently dropping it.
   Done when: `pnpm lint` and `pnpm fmt:check` run (their findings are handled in gap 4), and every delta against the staged reference configs is a named project rule.

4. **Formatting pass** — signal: `pnpm fmt:check` fails broadly on the existing codebase.
   Run `pnpm fmt` in a **dedicated commit** so the mechanical reformat stays separate from every other change in the upgrade branch.
   Done when: `pnpm fmt:check` passes.

## Out of Scope

- CI pipeline changes — covered by the `ci` domain, not this intention.
- Fixing lint findings beyond `oxlint --fix` autofixes; genuine rule violations in project code are the project's call.
- Lint/format configs of tools embedded in sub-apps for other purposes.

## Reference Paths

- `package.json` — **adapt**
- `.oxlintrc.json` — **adapt**
- `.oxfmtrc.json` — **copy**

## Validation

- `pnpm install` completes if dependencies changed.
- `pnpm lint` runs.
- `pnpm fmt:check` passes.

## Record Result

Run `pnpm boilerplate upgrade record --id v1.0.0/standardize-oxlint-oxfmt --applied` after validation passes, or record it as skipped with a reason.
