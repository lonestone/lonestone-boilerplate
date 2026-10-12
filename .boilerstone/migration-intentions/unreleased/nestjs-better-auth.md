---
id: unreleased/nestjs-better-auth
domain: auth
classification: breaking-manual
pr: 130
---

# Use @thallesp/nestjs-better-auth with a global guard

## Goal

The API wires Better Auth into NestJS through `@thallesp/nestjs-better-auth`. The in-tree guard, decorators, service and module definition are gone. Every route requires a session unless it is marked `@AllowAnonymous()` or `@OptionalAuth()`.

## Why

The boilerplate carried its own NestJS glue for Better Auth: a module that discovers hook providers, a guard, a service, and the `Public` / `Optional` / `Session` decorators. That is code every project had to keep working when Nest or Better Auth moved. Better Auth's NestJS documentation points to this community package, which covers the same ground and adds `@Roles()` and `@OrgRoles()` for the admin and organizations addons. The package peers `better-auth` 1.5 up to (not including) 2.0, and Nest 11 or 12.

The guard changes from opt-in to opt-out. Before, a route was protected only if it carried `@UseGuards(AuthGuard)`. Now the package registers its guard globally, so a controller added without any annotation is protected, not public. A forgotten annotation fails closed.

That is also the breaking part for a project that already exists. Any route that was public because it had no guard (a health check, a webhook, a public read) now answers 401 until it carries `@AllowAnonymous()`. This is why the intention is `breaking-manual`: a person must decide, route by route, what stays public.

Two choices in the wiring are deliberate:

- `disableTrustedOriginsCors: true`. The package's own CORS call would replace the app-level `enableCors` in `main.ts` and leaves out `PATCH`.
- `bodyParser: false` stays on `NestFactory.create`. The package adds JSON and form parsers itself and skips the auth base path, so Better Auth receives an unparsed body. This replaces the global `express.json()` middleware that `main.ts` used to carry.

The package loads `express` for its body parsers and declares `express` 5 as a peer. Nest 11 already runs on Express 5, so the direct `express` dependency moves from 4 to 5 instead of silencing the peer warning.

Known limit of the package: its guard calls `getSession()` before it checks `@AllowAnonymous()`, so a public route still does a session lookup when the request carries a cookie (upstream issue 159). The old in-tree guard did the same.

## Applies When

- `apps/api/src/modules/auth/auth.guard.ts` exists.
- Controllers use `@UseGuards(AuthGuard)`, or import `Session`, `Public` or `Optional` from `auth.decorator`.
- The API still builds the Nest wiring with `ConfigurableModuleBuilder` in `auth.definition.ts`.

## Do Not Apply When

- The project has no `api` app.
- The project does not use Better Auth.
- A human has reviewed this intention and decided to keep the in-tree guard, for example because it carries project-specific role logic. Record it as skipped with that reason.

## Observable Gaps

1. **Dependencies** — signal: `@thallesp/nestjs-better-auth` is missing from `apps/api/package.json`, or `express` is below 5.
   Align with the staged reference `apps/api/package.json` and the `auth` catalog entry in `pnpm-workspace.yaml`. Touch no other dependency.
   Done when: `pnpm install` finishes with no peer dependency warning for the package.

2. **Auth module wiring** — signal: `apps/api/src/modules/auth/auth.module.ts` uses `ConfigurableModuleClass`, `DiscoveryService` or `MODULE_OPTIONS_TOKEN`, and does not call the package's `forRootAsync`.
   Keep the project's `createBetterAuth()` options and email callbacks. Replace the glue with the package's `forRootAsync`, with `disableTrustedOriginsCors: true`, a `bodyParser` block, and a `middleware` that opens the MikroORM `RequestContext`.
   Done when: the API logs `AuthModule initialized BetterAuth on '/api/auth'` at startup.

3. **In-tree glue files** — signal: any of `auth.guard.ts`, `auth.decorator.ts`, `auth.service.ts`, `auth.definition.ts` exists in `apps/api/src/modules/auth/`.
   Point every import (`Session`, `AuthService`, `Hook`, `BeforeHook`, `AfterHook`) at the package, then delete the four files and their entries in `knip.json`.
   Done when: `rg "auth/auth\.(guard|decorator|service|definition)" apps/api/src` finds nothing.

4. **Route protection** — signal: `rg "UseGuards\(AuthGuard\)" apps/api/src` matches, or a controller depends on being public by default.
   Remove `@UseGuards(AuthGuard)`. List every route of every controller with its intended access. Add `@AllowAnonymous()` to each route that must stay public (health, webhooks, public reads) and `@OptionalAuth()` where a session is optional. Do not change which routes are public; only write down what the project already intends.
   Done when: an unauthenticated request to each protected route returns 401 and to each public route does not.

5. **Body parsing in `main.ts`** — signal: `apps/api/src/main.ts` registers a global `express.json()` middleware or skips `/auth` by hand.
   Remove the JSON middleware and keep `bodyParser: false`. Keep a raw-body middleware only for webhook paths that need the raw bytes.
   Done when: `POST /api/auth/sign-up/email` and a JSON `POST` to a route outside `/api/auth` both succeed.

6. **E2E helpers** — signal: `apps/api/src/test/helpers/test-app.helper.ts` overrides a local `AuthService` or calls `createMockAuthService`.
   Align with the staged `test-app.helper.ts` and `test-auth.helper.ts`: mock `auth.api.getSession` and register the package module with `disableControllers: true`.
   Done when: `pnpm --filter=api test` passes.

## Out of Scope

- The auth entities, the MikroORM adapter, the schema codegen, and the options passed to `createBetterAuth()`.
- Adding `@Roles()` or `@OrgRoles()` to controllers. The admin and organizations addon guides cover that.
- The frontend auth client.
- Changing which routes are public.

## Reference Paths

- `apps/api/src/modules/auth/auth.module.ts` — **adapt**
- `apps/api/src/main.ts` — **adapt**
- `apps/api/src/test/helpers/test-app.helper.ts` — **adapt**
- `apps/api/src/test/helpers/test-auth.helper.ts` — **adapt**
- `apps/api/src/modules/example/posts/posts.controller.ts` — **adapt**
- `apps/api/package.json` — **adapt**
- `pnpm-workspace.yaml` — **adapt**

## Validation

- `pnpm install` finishes with no peer dependency warning for the package.
- `pnpm --filter=api typecheck` passes.
- `pnpm --filter=api test` passes.
- `pnpm lint` passes.
- With the API running: `GET /api/auth/ok` returns 200, sign-in sets a session cookie, a protected route returns 401 without the cookie and 200 with it, a public route returns 200 without it, and a `PATCH` preflight from a trusted origin is allowed.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/nestjs-better-auth --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
