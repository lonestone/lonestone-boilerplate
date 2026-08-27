---
id: v1.1.0/migrate-react-router-8
domain: frontend
classification: migration
---

# Migrate React Router 8

## Goal

SPA, SSR, and the shared UI package depend on React Router 8.3, and route `meta` / `useMatches` read `loaderData` instead of the removed `data` field.

## Why

The boilerplate moved from React Router 7.18 to 8.3. Route APIs renamed `data` to `loaderData` on `meta` arguments and `useMatches()` results. Staying on v7 leaves the project off the tested constellation; bumping the packages without the rename breaks typecheck and runtime meta.

## Applies When

- The project tracks the `frontend` domain.
- Any app or shared package still depends on `react-router` / `@react-router/*` below 8, or route modules still read `meta({ data })` / `match.data` for loader results.

## Do Not Apply When

- The project has no React Router app (no SPA/SSR, no `react-router` dependency).
- A human has explicitly decided to stay on React Router 7 after reviewing this intention — record as skipped with that reason. Still being on v7 is **not** a skip condition.

## Observable Gaps

1. **Catalog / package versions** — signal: `pnpm-workspace.yaml` `catalogs.frontend` (or the app `package.json`) still pins `react-router`, `@react-router/dev`, `@react-router/node`, or `@react-router/serve` to a 7.x range.
   Align only those React Router keys with the staged reference. Touch no other catalog family here.
   Done when: `pnpm install` resolves React Router 8.3 for those packages.

2. **`meta` loader results** — signal: a route `meta` function still destructures `{ data }` (or reads `args.data`) for loader output.
   Rename to `{ loaderData }` matching staged files such as `apps/web-ssr/app/features/posts/post-detail-page.tsx`. Leave unrelated `data` properties (API payloads, form fields) untouched.
   Done when: `pnpm --filter=@boilerstone/web-ssr typecheck` and `pnpm --filter=@boilerstone/web-spa typecheck` pass (or the project's equivalent filters).

3. **`useMatches` loader results** — signal: code reads `match.data` from `useMatches()` for loader output.
   Rename to `match.loaderData` matching staged `apps/web-ssr/app/hooks/use-dehydrated-state.ts`.
   Done when: dehydrated-state / match consumers typecheck.

4. **Route component props** — signal: a route component still types loader results as `data` on `Route.ComponentProps` instead of `loaderData`.
   Follow the staged route modules (`loaderData` on the component props). Do not rewrite feature UI.
   Done when: route modules compile against React Router 8 types.

## Out of Scope

- Other `frontend` catalog entries (React, Tailwind, TanStack Query) — `unreleased/align-shared-dependency-versions`.
- i18n language-key identity — `unreleased/unify-i18n-language-keys`.
- Rewriting navigation, loaders, or feature pages beyond the `data` → `loaderData` rename.

## Reference Paths

- `pnpm-workspace.yaml` — **adapt**
- `apps/web-spa/package.json` — **adapt**
- `apps/web-ssr/package.json` — **adapt**
- `packages/ui/package.json` — **adapt**
- `apps/web-ssr/app/hooks/use-dehydrated-state.ts` — **adapt**
- `apps/web-ssr/app/features/posts/post-detail-page.tsx` — **adapt**
- `apps/web-ssr/app/features/authors/author-posts-page.tsx` — **adapt**

## Validation

- `pnpm install` completes.
- `pnpm --filter=@boilerstone/web-spa typecheck` and `pnpm --filter=@boilerstone/web-ssr typecheck` pass when those apps exist.
- Grep for route `meta({ data })` / `match.data` loader usage finds no remaining hits in app route modules.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/migrate-react-router-8 --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
