---
id: unreleased/interface-prefix-rule
domain: tooling
classification: migration
---

# Write the interface prefix rule once, in the project guide

## Goal

The project guide states one rule for interface and type names: PascalCase, with no `I` prefix, except for a contract that has several implementations.

## Why

The boilerplate once asked for an `I` prefix on every interface. No interface followed it, so commit `1c77be3` dropped the rule. An `I` prefix suggests that a class will implement the interface. That is only useful for a contract with several implementations.

The guide now states the rule in one place. The backend page no longer repeats the naming line on its own.

Existing names stay as they are. Each project decides whether to rename its own types.

## Applies When

- The project tracks the `tooling` domain.
- The project has a naming guide at `apps/documentation/src/content/docs/references/general.mdx`.

## Do Not Apply When

- The project has no documentation app, or moved its guide somewhere else. Apply the same rule in the file that holds the project's naming conventions.
- A human has decided to keep a different interface naming rule after reviewing this intention.

## Observable Gaps

1. **Rule in the general guide** — signal: `apps/documentation/src/content/docs/references/general.mdx` has no line that starts with `- Interfaces and types: PascalCase, no prefix`.
   Delete the "Interfaces names" item under "Use PascalCase for". Keep "Type definitions" and "Classes names" in that list. Add the single "Interfaces and types" line from the staged `general.mdx` as a top-level bullet right after the list. Keep the other naming rules as they are.
   Done when: `rg -n "Interfaces and types: PascalCase, no prefix" apps/documentation/src/content/docs/references/general.mdx` matches, and `rg -n "Interfaces names" apps/documentation/src/content/docs/references/general.mdx` has no match.

2. **No duplicate in the backend guide** — signal: `apps/documentation/src/content/docs/references/backend.mdx` contains a line with `Interfaces/Types` in its naming conventions.
   Remove that line. Keep the class, method, variable, constant and enum lines.
   Done when: `rg -n "Interfaces/Types" apps/documentation/src/content/docs/references/backend.mdx` has no match.

3. **No stray I prefix** — signal: `git grep -nE "(interface|type) I[A-Z]"` lists a name that has only one implementation.
   Each match must be a contract with several implementations, such as `IStorageProvider`. Rename or remove any other `I` prefix in the project's own code, and leave the rest of the code alone.
   Done when: every match is a contract with several implementations, checked by hand.

## Out of Scope

- Renaming existing interfaces or types. The project decides that for itself.
- The rules for classes, enums, files and variables.
- The `I` prefix on any contract with several implementations, such as `IStorageProvider`.

## Reference Paths

- `apps/documentation/src/content/docs/references/general.mdx` — **adapt**
- `apps/documentation/src/content/docs/references/backend.mdx` — **adapt**

## Validation

- `pnpm lint` passes.
- `pnpm fmt:check` passes.
- The two `rg` commands in the observable gaps behave as their "Done when" lines say.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/interface-prefix-rule --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
