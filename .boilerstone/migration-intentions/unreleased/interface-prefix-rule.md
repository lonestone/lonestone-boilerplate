---
id: unreleased/interface-prefix-rule
domain: tooling
classification: migration
---

# Write the interface prefix rule once, in the project guide

## Goal

The project guide states one rule for interface and type names: PascalCase, with no `I` prefix, except for a contract that has several implementations.

## Why

An `I` prefix suggests that a class will implement the interface. That is only useful for a contract with several implementations. The guide states the rule in one place, and existing names stay as they are.

## Applies When

- The project tracks the `tooling` domain.
- The project has a naming guide at `apps/documentation/src/content/docs/references/general.mdx`.

## Do Not Apply When

- The project has no `apps/documentation` app.
- A human has decided to keep a different interface naming rule after reviewing this intention.

## Observable Gaps

1. **Rule in the general guide** — signal: `apps/documentation/src/content/docs/references/general.mdx` has no line that starts with `- Interfaces and types: PascalCase, no prefix`.
   Delete the "Interfaces names" and "Type definitions" items under "Use PascalCase for". Keep "Classes names" in that list. Add the single "Interfaces and types" line from the staged `general.mdx` as a top-level bullet right after the list. Keep the other naming rules as they are. Reference: staged `general.mdx`.
   Done when: `rg -n "Interfaces and types: PascalCase, no prefix" apps/documentation/src/content/docs/references/general.mdx` matches, and `rg -n "Interfaces names|Type definitions" apps/documentation/src/content/docs/references/general.mdx` has no match.

2. **No duplicate in the backend guide** — signal: `apps/documentation/src/content/docs/references/backend.mdx` contains a line with `Interfaces/Types` in its naming conventions.
   Remove that line. Keep the class, method, variable, constant and enum lines. Reference: staged `backend.mdx`.
   Done when: `rg -n "Interfaces/Types" apps/documentation/src/content/docs/references/backend.mdx` has no match.

3. **No stray I prefix** — signal: `git grep -nE "(interface|type) I[A-Z]"` lists a name that has only one implementation.
   Each match must be a contract with several implementations, such as `IStorageProvider`. List any other match in the upgrade report for a human to decide. Do not rename it. Reference: the rule in staged `general.mdx`.
   Done when: every match is either a contract with several implementations, or is listed in the upgrade report for a human decision.

## Out of Scope

- Renaming existing interfaces or types. The project decides that for itself.
- The rules for classes, enums, files and variables.

## Reference Paths

- `apps/documentation/src/content/docs/references/general.mdx` — **adapt**
- `apps/documentation/src/content/docs/references/backend.mdx` — **adapt**

## Validation

- `pnpm lint` passes.
- `pnpm fmt:check` passes.
- The `rg` and `git grep` checks in the observable gaps behave as their "Done when" lines say.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/interface-prefix-rule --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
