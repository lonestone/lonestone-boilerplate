---
id: unreleased/stop-pre-push-quality-hang
domain: ci
classification: migration
---

# Stop the pre-push quality job from hanging

## Goal

`lefthook.yml` `pre-push` runs lint and typecheck with live output, does not read git stdin, and does not run the test suite.

## Why

Lefthook attaches a pseudo-TTY by default and does not close stdin when the hook data is done. The quality job read that stream with `STDIN=$(cat)`, so a push sat on `waiting: quality` until the process was killed. `use_stdin: true` on a `jobs` entry does not change that PTY behavior the way it does for lefthook `scripts`. The same job then ran `pnpm test`, which starts Postgres through Testcontainers and hangs when Docker is not running — the usual state right after `pnpm rock`. Lint and typecheck are enough for a local push gate. CI already runs the tests.

## Applies When

- The project tracks the `ci` domain.
- `lefthook.yml` exists.
- `pre-push` still reads stdin (`$(cat)` or `use_stdin: true`) or still runs `pnpm test`.

## Do Not Apply When

- The project has no `lefthook.yml`.
- `pre-push` already runs only lint and typecheck, with no stdin `cat` and no `pnpm test`.
- A human has explicitly decided to keep the heavier hook after reviewing this intention — record as skipped with that reason.

## Observable Gaps

1. **No stdin drain** — signal: `lefthook.yml` `pre-push` sets `use_stdin: true` or the quality script contains `$(cat)`.
   Remove `use_stdin` and the stdin `cat` / `(delete)` skip. Deleting a remote branch may now run lint and typecheck; that is acceptable.
   Done when: `rg "use_stdin|\\$\\(cat\\)" lefthook.yml` returns nothing.

2. **No Testcontainers on push** — signal: the quality job runs `pnpm test`.
   Drop that line. Do not add a different test command.
   Done when: `rg "pnpm test" lefthook.yml` returns nothing.

3. **Lint and typecheck stay** — signal: `pre-push` no longer runs `pnpm lint` or `pnpm typecheck`.
   Keep both, in that order, with `|| exit 1`.
   Done when: the quality script still contains `pnpm lint` and `pnpm typecheck`.

4. **Live output** — signal: `pre-push` has no `follow: true`.
   Set `follow: true` on the `pre-push` hook so lefthook prints lint and typecheck as they run.
   Done when: `lefthook.yml` has `follow: true` under `pre-push`.

## Out of Scope

- Commit-msg commitlint.
- CI workflows.
- Test script definitions in `package.json`.
- Docker or Testcontainers configuration.

## Reference Paths

- `lefthook.yml` — **adapt**

## Validation

- `lefthook.yml` has no `use_stdin` and no `$(cat)`.
- `lefthook.yml` does not run `pnpm test`.
- `pnpm exec lefthook run pre-push` starts lint (skip a full run if the tree is large; the config shape is the check).

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/stop-pre-push-quality-hang --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
