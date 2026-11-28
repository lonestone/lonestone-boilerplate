---
id: unreleased/no-fork-transactional-lint
domain: api
classification: migration
---

# Block em.fork() and em.transactional() in the API with the linter

## Goal

`.oxlintrc.json` blocks `em.fork()` and `em.transactional()` in `apps/api/src`, except in specs and `src/test`. `references/backend.mdx` says to use `@Transactional()` instead.

## Why

The rule "use `@Transactional()`" was only in the docs, and an agent still wrote `this.em.fork().persist(...).flush()` in services. A request already has its own `EntityManager`, so the fork is not needed. The linter tells the agent at the moment it writes the code.

## Applies When

- The project has `apps/api`, uses MikroORM and uses Oxlint.
- `.oxlintrc.json` has no `no-restricted-properties` rule on `fork` and `transactional`.

## Do Not Apply When

- A human decided to keep `em.fork()` and `em.transactional()` allowed in services.

## Observable Gaps

1. **Lint rule missing** — signal: no `eslint/no-restricted-properties` entry for `fork` in `.oxlintrc.json`.
   Adapt the two overrides from the staged `.oxlintrc.json`. Keep the project's own overrides and paths.
   Done when: `grep -c '"property": "fork"' .oxlintrc.json` is at least 1.
2. **Spec exclusion missing** — signal: no override that turns the rule `off` for `apps/api/src/**/*spec.ts` and `apps/api/src/test/**`.
   Add it after the rule override, as in the staged `.oxlintrc.json`.
   Done when: `grep -c 'e2e-spec.ts' .oxlintrc.json` is at least 1.
3. **Existing calls** — signal: `pnpm lint` reports `no-restricted-properties` in a service.
   Propose the fix to a human, one call at a time. Replace `em.transactional()` with `@Transactional()`. Remove a useless `em.fork()`. For a real use outside a request, add a comment that says why, then `// oxlint-disable-next-line eslint/no-restricted-properties`.
   Done when: `pnpm lint` has no `no-restricted-properties` error.
4. **Docs** — signal: `references/backend.mdx` does not say "do not call `em.fork()` or `em.transactional()` by hand".
   Add the one bullet from the staged `references/backend.mdx` if the project keeps these docs.
   Done when: the bullet is present.

## Out of Scope

- Tests and specs: `em.fork()` stays allowed there.
- Adding `@Transactional()` to methods that do one `flush()`.
- The project's other lint rules and overrides.

## Reference Paths

- `.oxlintrc.json` — **adapt** (keep the project's own rules, paths and overrides)
- `apps/documentation/src/content/docs/references/backend.mdx` — **adapt**
- `apps/documentation/src/content/docs/explanations/3_linter.mdx` — **adapt**
- `apps/documentation/src/content/docs/core-features/3_filestorage.mdx` and `explanations/5_orm.mdx` — **adapt** (wording only)

## Validation

- `pnpm lint` passes.
- `pnpm typecheck` passes.

## Record Result

Run `pnpm boilerplate upgrade record --id vX.Y.Z/no-fork-transactional-lint --applied`
