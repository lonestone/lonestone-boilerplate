---
id: unreleased/slim-lefthook-pre-push
domain: ci
classification: migration
---

# Slim the Lefthook pre-push quality job

## Goal

`lefthook.yml` `pre-push` streams lint and typecheck with `follow: true`. It does not read stdin, skip on a `(delete)` line, or run `pnpm test`. Tests stay in CI.

## Why

The quality job called `STDIN=$(cat)` with `use_stdin: true`. Lefthook's pseudo-TTY often never closes stdin, so the hook sat on `waiting: quality` before any check ran. The `(delete)` skip never matched git's pre-push ref lines anyway. After stdin returned, `pnpm test` started API Testcontainers (PostgreSQL image pull plus boot) with no streamed output, so a first push looked hung for minutes. CI already runs the suite. Local pre-push only needs lint and typecheck, and those need visible output.

## Applies When

- The project tracks the `ci` domain.
- `lefthook.yml` exists (projects still on Husky belong to `v1.1.0/adopt-conventional-commits` first).
- The `pre-push` quality job still reads stdin (`use_stdin` / `STDIN=$(cat)`), greps `^(delete)`, or runs `pnpm test`. That leftover is the starting state this intention migrates away from, not a skip reason.

## Do Not Apply When

- The project has no `lefthook.yml` and has explicitly stayed off Lefthook — record as skipped.
- A human has explicitly decided to keep tests (or a custom stdin skip) on pre-push after reviewing this intention — record as skipped with that reason.

## Observable Gaps

Work through each gap independently; skip any that is already closed.

1. **No stdin wait** — signal: `lefthook.yml` `pre-push` quality job sets `use_stdin: true`, or its `run` script assigns `STDIN=$(cat)` / greps `^(delete)`.
   Drop `use_stdin`, the `cat`, and the delete skip, matching the staged reference `lefthook.yml`. Keep the `commit-msg` commitlint job.
   Done when: `rg "use_stdin|STDIN=\\$\\(cat\\)|\\^\\(delete\\)" lefthook.yml` returns nothing.

2. **Streamed output** — signal: `pre-push` has no `follow: true`.
   Add `follow: true` on the `pre-push` hook, matching the staged reference.
   Done when: `lefthook.yml` has `follow: true` under `pre-push`.

3. **Tests stay in CI** — signal: the `pre-push` quality `run` script still calls `pnpm test`.
   Remove that step. Keep `pnpm lint` then `pnpm typecheck`. Do not change `.github/workflows/ci.yml`.
   Done when: `rg "pnpm test" lefthook.yml` returns nothing, and the quality job still runs `pnpm lint` and `pnpm typecheck`.

4. **Contributing note** — signal: `CONTRIBUTING.md` does not say pre-push is lint and typecheck, with tests in CI.
   Add that one sentence next to the existing lefthook/commitlint sentence in the staged reference `CONTRIBUTING.md`. Do not rewrite the rest of the convention.
   Done when: `CONTRIBUTING.md` states that pre-push runs lint and typecheck and that tests run in CI.

## Out of Scope

- Commitlint rules, scopes, and the `commit-msg` job.
- CI workflows, Testcontainers, and splitting API unit vs e2e tests.
- Husky migration — that remains `v1.1.0/adopt-conventional-commits`.
- Re-running `pnpm rock`.

## Reference Paths

- `lefthook.yml` — **adapt**
- `CONTRIBUTING.md` — **adapt**

## Validation

- `rg "use_stdin|STDIN=\\$\\(cat\\)|\\^\\(delete\\)" lefthook.yml` returns nothing.
- `lefthook.yml` `pre-push` has `follow: true` and the quality job runs `pnpm lint` and `pnpm typecheck` without `pnpm test`.
- `pnpm exec lefthook install --reset-hooks-path` exits 0 if Lefthook is already a dependency.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/slim-lefthook-pre-push --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
