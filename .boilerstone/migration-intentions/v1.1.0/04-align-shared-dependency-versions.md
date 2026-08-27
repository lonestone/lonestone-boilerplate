---
id: v1.1.0/align-shared-dependency-versions
domain: tooling
classification: migration
requires:
  - v1.1.0/adopt-typescript-6
---

# Align Shared Dependency Versions

## Goal

Every catalog family the project shares with this boilerplate release is either raised to that release's tested version set, or explicitly pinned older in the project's catalogs with a named reason.

## Why

The next release refreshed the `frontend`, `auth`, and `build` catalogs (Better Auth 1.6.25, Vite 7.3.6, React 19.2.8, and related pins) after a recursive workspace upgrade. Aligning older projects onto that constellation is core maintenance value — but a bump is never just a JSON line, so this intention works **one catalog family at a time**, with validation and a commit per family, and an explicit escape hatch instead of unbounded fixing.

## Applies When

- The project tracks the `tooling` domain and already uses pnpm catalogs (`v1.0.0/align-dependency-baseline` applied).
- `unreleased/adopt-typescript-6` is applied or skipped with a reason (TypeScript itself is owned by that intention).
- At least one catalog family the project uses is behind the staged reference versions.

## Do Not Apply When

- The catalogs mechanism is not adopted yet — apply `v1.0.0/align-dependency-baseline` first.
- TypeScript 6 is not decided yet — apply or skip `unreleased/adopt-typescript-6` first. Do not bump `catalogs.build.typescript` here.
- A human asked for a bulk `pnpm update` / catalog-wide bump — that is out of scope; stop and ask.

## Observable Gaps

Work **one catalog family at a time** (e.g. `frontend`, then `auth`, then remaining `build` entries except `typescript`), in this loop; never mix families in one commit.

1. **Per family: raise or pin** — signal: the family's catalog entries are below the staged reference `pnpm-workspace.yaml` values.
   Raise the family's catalog entries to the reference values, run `pnpm install`, then `pnpm typecheck` and the project's tests. Apply **mechanical fixes only** (renamed imports/options, following that family's changelog). Commit as `chore: align <family> dependencies with boilerplate v1.1.0`.
   If the breakage goes beyond mechanical fixes: revert that family, keep its current version in the catalog with a `# pinned: <reason>` comment above the entries, and move on to the next family.
   Done when: the family is at reference versions with validations passing, or pinned with a named reason.

2. **Skip TypeScript in `build`** — signal: temptation to include `typescript` in the `build` family commit.
   Leave `typescript` to `unreleased/adopt-typescript-6`. Other `build` entries (`vite`, `vite-tsconfig-paths`, `@types/node`) still belong here.
   Done when: the `build` family commit does not change `typescript`.

3. **Skip React Router in `frontend`** — signal: temptation to include `react-router`, `@react-router/dev`, `@react-router/node`, or `@react-router/serve` in the `frontend` family commit.
   Leave those keys to `unreleased/migrate-react-router-8`. Other `frontend` entries still belong here.
   Done when: the `frontend` family commit does not change React Router packages.

4. **Sweep check** — signal: a shared dependency escaped the catalogs (still pinned directly in an app `package.json`).
   Move it to its catalog family first, then it falls under gap 1.
   Done when: every dependency shared with the boilerplate catalogs resolves through a catalog.

## Out of Scope

- Dependencies the project added that the boilerplate does not ship.
- React Router 7 → 8 API (`loaderData`) — `unreleased/migrate-react-router-8`.
- Non-catalog app bumps (NestJS, Sentry, Langfuse, AI SDK, oxlint/oxfmt/knip patch versions). Those are not a coherent catalog family; do not bulk-upgrade them from this intention.
- Rewriting app code beyond the mechanical fixes a family's changelog prescribes — deeper breakage means pin-and-name, not a refactor.
- The `cookie` override and Astro pin — those are `unreleased/pin-cookie-override-for-hoist`.

## Reference Paths

- `pnpm-workspace.yaml` — **adapt**
- `package.json` — **adapt**
- `apps/api/package.json` — **adapt**
- `apps/web-spa/package.json` — **adapt**
- `apps/web-ssr/package.json` — **adapt**

## Validation

- `pnpm install`, `pnpm typecheck` and existing tests pass after each family commit.
- Every shared family is at reference versions or carries a `# pinned: <reason>` comment in `pnpm-workspace.yaml`.
- The PR summary lists each family: aligned or pinned (with reason).

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/align-shared-dependency-versions --applied` once every shared family is aligned or explicitly pinned, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
