---
id: unreleased/api-tests-e2e-only
domain: docs
classification: migration
---

# Write API e2e tests only

## Goal

The project's agent rules say which tests to write: API e2e tests for routes. They also say which tests not to write: unit tests, and tests for one-off scripts.

## Why

The testing guide showed unit tests and e2e tests side by side and never said which to pick. Agents wrote many tests, some with little value: unit tests of services that their routes already cover, and tests for one-off scripts. Those tests cost time to write, run and maintain.

The guide now has a short, firm rule at the top, with one narrow exception that a pull request must declare. A reviewer can check it. `AGENTS.md` points to it.

## Applies When

- The project has the `api` app.
- `apps/documentation/src/content/docs/guides/api-testing.mdx` does not contain the heading `The rule: test the routes, end to end`.

## Do Not Apply When

- The team chose another testing policy on purpose (for example, unit tests required). Record as skipped with that reason.

## Observable Gaps

1. **Rule in the guide** — signal: `api-testing.mdx` has no heading `The rule: test the routes, end to end`.
   Copy the section from the staged reference and keep the project's own sections below it.
   Done when: the heading exists at the top of the guide.

2. **Contradicting guidelines** — signal: `rg "Write unit tests" apps/documentation/src/content/docs/references` matches.
   Replace those bullets with the ones from the staged `general.mdx` and `backend.mdx`.
   Done when: the same `rg` returns nothing.

3. **Pointer in AGENTS.md** — signal: `AGENTS.md` has no line starting with `Tests:` that names `api-testing.mdx`.
   Add the line from the staged reference.
   Done when: the line exists.

## Out of Scope

- Existing tests. The project's team decides whether to delete its `*.spec.ts` files.
- The project's own modules and scripts.

## Reference Paths

- `apps/documentation/src/content/docs/guides/api-testing.mdx` — **adapt**
- `apps/documentation/src/content/docs/references/general.mdx` — **adapt**
- `apps/documentation/src/content/docs/references/backend.mdx` — **adapt**
- `AGENTS.md` — **adapt**

## Validation

- `pnpm lint` passes.
- `pnpm -r build` passes (the documentation build checks the guide's links).

## Record Result

Run `pnpm boilerplate upgrade record --id vX.Y.Z/api-tests-e2e-only --applied` after validation passes, or record it as skipped with a reason.
