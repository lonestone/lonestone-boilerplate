---
id: unreleased/push-after-local-gates
domain: tooling
classification: migration
---

# Push only when the local checks pass

## Goal

The project guide tells agents to push only when lint, typecheck and the tests of the changed packages pass locally.

## Why

The pre-push hook runs lint and typecheck, but not tests. An agent that pushes after a green hook can still fail the CI on a test it never ran. The CI should confirm a result the agent already has.

## Applies When

- The project tracks the `tooling` domain.
- The project has a guide at `apps/documentation/src/content/docs/references/general.mdx`.

## Do Not Apply When

- `.boilerstone/migration-intentions/` exists. This is the boilerplate repository, or a fork that publishes its own intentions. Record as skipped.
- A human has decided to keep a different push rule after reviewing this intention.

## Observable Gaps

1. **Push rule in the general guide** — signal: `rg -n "Push only when" apps/documentation/src/content/docs/references/general.mdx` finds nothing.
   Add the single "Push only when" bullet from the staged `general.mdx` at the end of the "General philosophy" list. Adapt the test command if the project does not use `pnpm --filter <package> test`. Reference: staged `general.mdx`.
   Done when: `rg -n "Push only when" apps/documentation/src/content/docs/references/general.mdx` matches once.

## Out of Scope

- `lefthook.yml`. The pre-push hook stays as it is, and tests do not move into it.
- A project that already has its own push rule, for example in `.agents/workflow.md`. Keep that rule and record this intention as skipped.

## Reference Paths

- `apps/documentation/src/content/docs/references/general.mdx` — **adapt**

## Validation

- `rg -n "Push only when" apps/documentation/src/content/docs/references/general.mdx` matches once.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/push-after-local-gates --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
