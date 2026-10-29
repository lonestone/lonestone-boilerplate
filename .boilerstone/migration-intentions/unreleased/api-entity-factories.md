---
id: unreleased/api-entity-factories
domain: api
classification: migration
---

# Build test and seed data with entity factories

## Goal

The API has one MikroORM `Factory` class per entity in `<module>.factory.ts`, and tests and seeders build their data with them.

## Why

The boilerplate had no factory convention. The only example, `createUserData` in `auth.factory.ts`, is a plain function without Faker. Two comments in `src/test/helpers/` sent readers to factory folders that never existed (`src/factories/`, `src/test/factories/`). So each test built its entities by hand, or through several HTTP calls, and repeated every required field.

A factory fills the required fields with Faker. A test then passes only the values it checks, and a reader sees at once what matters to it. The same classes serve the seeders, so seed data and test data are built the same way.

MikroORM's own `Factory` (`@mikro-orm/seeder`) was chosen over a home-made builder: the package and `@faker-js/faker` are already API dependencies, and it gives `makeOne()` (persist, no flush), `createOne()` (flush) and `.each()` for relations.

`createUserData` stays a function. Better Auth needs a hashed password (async, which `definition()` is not) and a credential `Account`, and seeders rely on it reusing an existing user by email.

## Applies When

- The project has the `api` app.
- `@mikro-orm/seeder` is a dependency of `apps/api/package.json`.
- No `*.factory.ts` file in `apps/api/src/modules/` extends `Factory` from `@mikro-orm/seeder`.

## Do Not Apply When

- The project already has another test-data convention its team chose on purpose (another builder library, fixtures). Record as skipped with that reason.

## Observable Gaps

1. **Stale comments** — signal: `rg "src/factories|test/factories|CURSOR_TEST_IMPROVEMENT_PROMPT" apps/api/src` matches.
   Replace those comments with the ones from the staged references `apps/api/src/test/helpers/test-user.helpers.ts`, `apps/api/src/test/helpers/test-app.helper.ts` and `apps/api/src/test/README.md`.
   Done when: the same `rg` returns nothing.

2. **Factory convention documented** — signal: `apps/documentation/src/content/docs/guides/factories.mdx` does not exist.
   Copy it, add the `factory.ts` line, step 7 and the testing bullet from the staged `backend.mdx`, then run `pnpm --filter @boilerstone/documentation generate:index` (use the project's package name).
   Done when: the guide exists and `apps/documentation/INDEX.md` lists it.

3. **Example factories** — signal: the project still has `apps/api/src/modules/example/` and no `posts.factory.ts` there.
   Copy `posts.factory.ts` and `comments.factory.ts`, then port the arrange steps of the two example e2e tests and `MinimalSeeder`. Skip this gap if the project deleted the example module.
   Done when: `pnpm --filter=api test` passes.

4. **`createUserData` comment** — signal: the JSDoc of `createUserData` in `apps/api/src/modules/auth/auth.factory.ts` does not say why it is not a `Factory` class.
   Adapt the JSDoc from the staged reference. Do not change the function's signature or behavior.
   Done when: the JSDoc explains the exception.

## Out of Scope

- The project's own modules. Writing factories for them is a follow-up the team chooses, not part of this intention.
- `createUserData` behavior and its callers.
- `PostSeeder`, `CommentSeeder` and `TagSeeder`, which keep their curated content.

## Reference Paths

- `apps/api/src/modules/example/posts/posts.factory.ts` — **copy**
- `apps/api/src/modules/example/comments/comments.factory.ts` — **copy**
- `apps/api/src/modules/example/posts/tests/posts.controller.e2e-spec.ts` — **adapt**
- `apps/api/src/modules/example/comments/tests/comments.controller.e2e-spec.ts` — **adapt**
- `apps/api/src/seeders/minimal.seeder.ts` — **adapt**
- `apps/api/src/modules/auth/auth.factory.ts` — **adapt**
- `apps/api/src/test/helpers/test-user.helpers.ts` — **adapt**
- `apps/api/src/test/helpers/test-app.helper.ts` — **adapt**
- `apps/api/src/test/README.md` — **adapt**
- `apps/documentation/src/content/docs/guides/factories.mdx` — **copy**
- `apps/documentation/src/content/docs/references/backend.mdx` — **adapt**

## Validation

- `pnpm lint` passes.
- `pnpm typecheck` passes.
- `pnpm --filter=api test` passes.
- `pnpm -r build` passes (the documentation build checks the guide's links).

## Record Result

Run `pnpm boilerplate upgrade record --id vX.Y.Z/api-entity-factories --applied` after validation passes, or record it as skipped with a reason.
