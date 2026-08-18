# Code and maintainability audit

**Date:** 2026-08-18  
**Scope:** Whole repository (API, web-spa, web-ssr, shared packages, tooling, CI, documentation, Boilerstone)  
**Method:** Static review against [general](../../apps/documentation/src/content/docs/references/general.mdx), [backend](../../apps/documentation/src/content/docs/references/backend.mdx), and [frontend](../../apps/documentation/src/content/docs/references/frontend.mdx) guidelines. Tests were not executed in this pass.

This is a report-only audit. No production code was changed.

---

## Verdict

The boilerplate is a **solid, well-typed starting point** with a clear design philosophy (keep it simple, easy to remove, 80% features only). Architecture, OpenAPI typing, and the AI/auth foundations are above average for a template.

It is **not production-hardened by default**. Example modules stay enabled, several public write endpoints have no abuse controls, frontend tests do not exist, and documentation has drifted from the current stack (oxlint, i18n package, removed schematics, removed MinIO).

**Overall maintainability: 7 / 10**

Copy-paste a feature from `posts` / SPA auth and you will do well. Ship `ExampleModule` and the SSR journal as-is to production and you will inherit teaching-code bugs and unauthenticated LLM routes.

| Area | Score | One-line read |
|------|------:|---------------|
| Type safety | 9 | No production `any`; Zod + OpenAPI pipeline is the standout. |
| API module conventions | 7 | Posts/comments match the docs; auth/AI/examples diverge. |
| Frontend structure | 5 | Guidelines (`*-queries.ts`, i18n everywhere, feature folders) are only partly followed. |
| SPA vs SSR duplication | 7 | Low literal duplication (~0.2%); pattern drift is the real risk. |
| Tests | 4 | Excellent AI unit tests and one posts e2e; almost nothing else. |
| Documentation accuracy | 4 | Multiple stale pages still describe removed packages and old tooling. |
| CI | 6 | Core lint/build/typecheck/test is good; fmt, frontend, and knip gates are weak. |
| Tooling / Boilerstone | 8 | Install + upgrade system is thoughtful; CLI is large relative to one shipped release. |
| Production hardening | 5 | Env validation and CORS are good; example AI routes and public likes are not. |

---

## What is done well

1. **End-to-end typing.** Zod contracts → `@lonestone/nzoth` → committed OpenAPI client. Frontend mutations can stay aligned with the API without GraphQL.
2. **Reference CRUD.** `modules/example/posts` is a clear template: entity, contract with `.meta()`, service returns entities, mapper in the controller, collection initialization checks.
3. **Fail-fast config.** `apps/api/src/config/env.config.ts` validates env with Zod at boot.
4. **AI module quality.** Layered service / Langfuse / rate-limit retry middleware, plus a ~900-line unit suite.
5. **Auth adapter investment.** Custom MikroORM adapter with a schema-drift test. High complexity, but the complexity is justified.
6. **Removable examples.** `ExampleModule` is a single import in `app.module.ts`, which matches the “easy to delete” philosophy.
7. **Monorepo sharing.** Both apps consume `@boilerstone/ui` and `@boilerstone/openapi-generator`. SPA vs SSR are different products, not two copies of the same app.
8. **Boilerstone design.** Intentions-not-diffs, git refs, consumer cleanup, detach path, and a large CLI test suite.
9. **Modern lint/format.** oxlint + oxfmt at the root; pnpm catalogs for shared versions.
10. **E2E harness.** Testcontainers + per-test DB isolation is production-grade even though only posts use it today.

---

## Findings

Severity:

- **P0** — correctness bug or production-abuse vector if the current tree is deployed
- **P1** — high-impact defect, broken workflow, or convention that will be copied wrongly
- **P2** — maintainability trap with real cost
- **P3** — polish, docs nits, dead code

### P0

| ID | Finding | Where |
|----|---------|-------|
| A1 | **Unauthenticated LLM example routes.** `AiExampleUseCasesController` is explicitly “no auth required” and is mounted because `ExampleModule` is imported in `AppModule`. Anyone who can reach the API can spend LLM budget. | `apps/api/src/modules/example/ai-example/ai-example-use-cases.controller.ts` (~L28), `apps/api/src/app.module.ts` (~L97) |
| F1 | **Hardcoded `postSlug: 'test'`** when fetching and loading comment replies. Nested replies hit the wrong post (or 404) on any real slug. | `apps/web-ssr/app/features/comments/comment-item.tsx` L47 and L159 |

### P1

| ID | Finding | Where |
|----|---------|-------|
| A2 | **Auth is opt-in per controller, while the code looks like a global-guard design.** `AuthGuard` reads `PUBLIC` / `OPTIONAL` metadata and `@Public()` exists, but there is no `APP_GUARD`. New controllers are public unless someone remembers `@UseGuards(AuthGuard)`. Comments only guard `DELETE`. | `apps/api/src/modules/auth/auth.guard.ts`, `auth.decorator.ts`, `auth.definition.ts` (`disableGlobalAuthGuard: false` is unused), `comments.controller.ts` |
| A3 | **Public like endpoint has no auth and no rate limit.** `POST /public/posts/:slug/like` can be inflated arbitrarily. | `apps/api/src/modules/example/posts/posts.controller.ts` ~L135–141 |
| A4 | **`PostService` throws generic `Error` for not-found.** Nest maps that to 500 instead of 404. Easy to copy into real modules. | `apps/api/src/modules/example/posts/posts.service.ts` (multiple throws, e.g. L65, L90, L144, L369) |
| A5 | **No default AI model**, while the AI README shows `isDefault: true`. Calls that omit `model` fail at runtime. | `apps/api/src/modules/ai/ai.config.ts` |
| F2 | **Zero frontend tests.** No Vitest/Playwright config under `web-spa`, `web-ssr`, `ui`, or `i18n`. Root `pnpm test` never exercises the UI. | apps and packages above |
| F3 | **SSR ignores `@boilerstone/i18n`.** Frontend guidelines require i18n and no hardcoded strings. The whole SSR journal is English literals. | `apps/web-ssr/` |
| F4 | **No `*-queries.ts` files.** Guidelines require TanStack Query options per feature. SPA inlines queries in pages; SSR uses loaders + ad-hoc keys. | both frontends |
| F5 | **`UserPostForm` uses a local type and no Zod resolver**, while create/edit pages already import OpenAPI schemas. Duplicated contract, weaker validation. | `apps/web-spa/app/features/examples/user-posts/user-post-form.tsx` |
| T1 | **`packages/schematics` is gone but still wired.** Root script `schematics:module` filters a missing package. Architecture doc still lists it and omits `packages/i18n`. | `package.json` L25, `apps/documentation/.../1_architecture.mdx`, `.oxlintrc.json` |
| T2 | **Root README documents `pnpm db:migrate:*` / `pnpm db:seed`**, which do not exist at the repo root. API seed script is `db:fresh:seed` / `db:migrate:seed`. | `README.md`, `apps/api/package.json` |
| T3 | **Linter documentation still describes ESLint/Antfu.** The repo uses oxlint/oxfmt. | `apps/documentation/.../3_linter.mdx` |
| T4 | **`.github/ACTIONS.md` is stale** (ESLint, Node 18, pnpm 8, `pnpm generate` in CI). | `.github/ACTIONS.md` vs `.github/workflows/ci.yml` |
| T5 | **CI does not run `fmt:check`.** Pre-push does not either. Formatting is optional in practice. | `.github/workflows/ci.yml`, `.husky/pre-push` |

### P2

| ID | Finding | Where |
|----|---------|-------|
| A6 | **`@Optional()` on comment create is misleading.** Guard is not on that route, so optional-session metadata never runs. | `comments.controller.ts` ~L43–51 |
| A7 | **N+1 comment counts** on post list endpoints. | `posts.service.ts` (repeated count queries in list mappers) |
| A8 | **AuthGuard swallows all errors as 401** and logs with `console.error`. A down database looks like a bad session. | `auth.guard.ts` L39–41 |
| A9 | **Sentry `sendDefaultPii: true`.** | `apps/api/src/instrument.ts` |
| A10 | **Anonymous comments have no rate limit / CAPTCHA.** Acceptable for a demo; dangerous if copied. | `comments.controller.ts` |
| F6 | **SSR `HydrationBoundary` is wired but no loader returns `dehydratedState`.** Dead plumbing. | `apps/web-ssr/app/root.tsx`, `use-dehydrated-state.ts` |
| F7 | **Theme hook duplicated** (`useTheme.ts` vs `use-theme.ts`). Error boundaries in both `root.tsx` files are near copies and hardcoded English. | both apps |
| F8 | **`AuthRedirect` is unused.** Dashboard reimplements the guard with `useEffect`. | `packages/ui/.../auth-redirect.tsx`, SPA dashboard |
| F9 | **Dead UI exports:** `Navigation`, `Header`, `data-table/*`. Components page builds its own table. | `packages/ui` |
| F10 | **`PostContent` in UI imports OpenAPI types.** Shared UI is coupled to the generated API client. | `packages/ui/src/components/posts/PostContent.tsx` |
| F11 | **SPA i18n is incomplete** (edit page, empty states, AI examples, error boundary). | `apps/web-spa` |
| F12 | **SSR comment errors are `console.error` only** — no toast, no user message. | `apps/web-ssr/app/features/comments/` |
| F13 | **`auth-client.ts` uses `@ts-ignore`** to import API types across the app boundary. | `apps/web-spa/app/lib/auth-client.ts` |
| T6 | **README still lists MinIO** in Docker services; compose only has Postgres + MailDev. File-storage doc is a stub. | `README.md`, `docker-compose.yml`, `3_filestorage.mdx` |
| T7 | **App READMEs still pin Node v18 / pnpm v8** and mention TanStack Form. Root engines are Node 24.13.0 / pnpm 10.28.2; forms use react-hook-form. | `apps/web-spa/README.md`, `apps/web-ssr/README.md` |
| T8 | **Frontend guidelines reference `schemas.gen.ts`**, which is not generated (`zod.gen.ts` is). | `frontend.mdx`, `packages/openapi-generator/` |
| T9 | **Knip never fails CI** (`--no-exit-code`) and does not cover `ui`, `i18n`, `.boilerstone`, or root `cli/`. | `package.json`, `knip.json` |
| T10 | **`packages/ui` and `packages/i18n` have no `typecheck` script**, so `pnpm -r typecheck` skips them. | package.json files |
| T11 | **`docs/` and `docs/features/` are documented in the README but were missing** until this audit folder. | `README.md` |
| T12 | **Boilerstone CLI is ~2.3k LOC** with one published release (`v1.0.0`). Dual naming `bootstrap` vs `upgrade init`. Worth it if releases continue; heavy if they do not. | `.boilerstone/cli/` |

### P3 (selected)

- Dead `Post.currentVersion()` (`posts.entity.ts`).
- Unused `@Public()` decorator.
- Typos: `reasonning` in AI contracts, `initialiazeTelemetry` in `instrument.ts`.
- Stale comment in `posts.contract.ts` pointing at `docs/api-guidelines.md`.
- API test README mentions `pnpm test:cov` and `src/factories/` (neither exists).
- `AGENTS.md` and `CLAUDE.md` are duplicates.
- PascalCase files in UI (`Header.tsx`, `Navigation.tsx`, `PostContent.tsx`) vs kebab-case guideline.
- `file-upload.tsx` is 1,132 lines — largest hand-written source file.
- Stripe raw-body path in `main.ts` with no Stripe module.
- `.gitignore` still has Expo / `.turbo` leftovers.
- `packages/ui/README.md` is empty; openapi-generator README is partly French and uses old paths.

---

## Maintainability notes (not just bugs)

### 1. Teaching code vs production code

The design philosophy accepts ~20% unused code if it is easy to remove. That is fine. The risk is that **example modules also encode insecure or incomplete patterns**:

- Unauthenticated AI use-cases
- Public likes without identity
- `Error` instead of Nest HTTP exceptions
- Opt-in auth that looks global

People copy the nearest controller. Those copies will not look like “demo only”.

**Recommendation:** Keep examples, but either gate them (`EXAMPLE_MODULE_ENABLED=false` in production) or make the copied pattern the *safe* one (auth on, Nest exceptions, rate limits documented).

### 2. Auth model is unfinished

`AuthGuard` already supports `@Public()` and `@Optional()`. That only pays off as a **global guard**. Today every new controller must remember `@UseGuards`. Comments show the failure mode: create is public, delete is guarded, `@Optional()` is cargo-culted.

Wire `APP_GUARD` or delete the unused public/optional machinery and document “opt-in only” in one sentence in the backend guidelines.

### 3. Frontend guidelines are ahead of the code

The documented SPA layout (`features/common`, `utils/*-queries.ts`, i18n everywhere, OpenAPI Zod in forms) is a good target. The current apps do not follow it. New work will either:

- copy the existing pages (inline queries, mixed i18n), or
- follow the docs and look “wrong” next to examples.

Align one of them. Prefer updating the examples to match the docs, since the docs are the agent/human contract.

### 4. SPA vs SSR is not a duplication problem

Literal overlap is tiny (`query-client.tsx` plus a theme hook). Do not extract a `packages/web-common` unless both apps start sharing UX. The cost is **divergent conventions** (kebab vs camel hooks, i18n vs none, loaders vs `useQuery`).

### 5. Documentation drift is the largest daily tax

Agents are told to read README, INDEX, architecture, and the three guideline files first. Several of those files are wrong (schematics, ESLint, MinIO, db scripts, Node 18, `schemas.gen.ts`). That will produce bad PRs faster than any missing abstraction.

A short “docs vs tree” pass is higher leverage than new features.

### 6. Test pyramid is inverted outside AI

AI is over-tested relative to everything else (good for that module). Posts have one e2e spec. Comments, auth guard, PostService, and both frontends have none. The e2e harness is ready; it is just unused.

### 7. Large files to watch

| File | Lines | Why it matters |
|------|------:|----------------|
| `.boilerstone/cli/boilerplate.ts` | 2301 | Upgrade UX lives here; hard to change safely. |
| `cli/setup.ts` | 1180 | First-run DX; high coupling to env files. |
| `packages/ui/.../file-upload.tsx` | 1132 | Candidate to split if file uploads become a real feature. |
| `apps/api/.../auth-db.adapter.ts` | 592 | Better Auth boundary; regressions are silent without tests. |
| `auth-schema-codegen.ts` | 539 | Generator; keep tests next to it. |
| `ai.service.ts` | 469 | Cohesive but growing. |

Generated OpenAPI files are large by design and should stay generated.

---

## Suggested fix order

Do not try to do all of this in one PR. Suggested batches:

1. **Safety (small code):** Pass the real `postSlug` into SSR comment replies. Add `AuthGuard` (or an env kill-switch) on `AiExampleUseCasesController`. Consider rate-limiting or removing public likes for the example.
2. **Broken commands / docs P0–P1:** Remove or restore `schematics:module`. Fix architecture tree (`i18n` in, `schematics` out). Rewrite linter page for oxlint. Fix root/API seed commands in README and `database-management.mdx`. Refresh or delete `.github/ACTIONS.md`. Fix app README engines.
3. **Auth consistency:** Register a global `AuthGuard` *or* document opt-in clearly and remove dead `@Public()` / `disableGlobalAuthGuard`. Replace `throw new Error('Post not found')` with `NotFoundException` in the example service so copies are correct.
4. **Frontend conventions:** Extract posts/comments query options; wire `UserPostForm` to `zCreatePostSchema`; add i18n to SSR or document it as English-only; delete or use dead UI exports; remove unused HydrationBoundary until a loader dehydrates.
5. **CI:** Add `fmt:check`. Add `typecheck` to `ui` and `i18n`. Decide whether knip should fail. Add at least one SPA and one SSR smoke test so frontend regressions cannot ship silently.

---

## Out of scope / not claimed

- Runtime test execution and coverage percentages
- Load / performance profiling
- Dependency CVE scan
- Visual / a11y review of UI primitives
- Whether Boilerstone should exist — only that its complexity is front-loaded relative to a single `v1.0.0` release
