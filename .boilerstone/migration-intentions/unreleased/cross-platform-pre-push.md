---
id: unreleased/cross-platform-pre-push
domain: tooling
classification: migration
---

# Run the pre-push quality gate from a Node script

## Goal

The `pre-push` job in `lefthook.yml` is the single plain command `pnpm verify`, and the delete-push detection plus the lint / typecheck / test sequence live in `scripts/pre-push.ts`. The hook then behaves the same on Windows, macOS and Linux.

## Why

The `pre-push` job used to hold a multi-line POSIX shell block inline in `lefthook.yml`: it read the push refs with `STDIN=$(cat)`, grepped them for `(delete)`, then chained `pnpm lint`, `pnpm typecheck` and `pnpm test`. Lefthook tokenizes an inline `run:` block on Windows and drops the quotes, so that block never ran correctly there — Windows contributors either saw the hook fail on syntax or silently skip the checks.

Keeping the shell and asking Windows users to install a POSIX shell was rejected: the boilerplate should not require a specific shell to push. Moving the logic into a TypeScript script run through `tsx` — which the repo already depends on for `rock`, `boilerplate` and `lint:pr` — leaves `lefthook.yml` with one plain command that needs no shell parsing.

Two details in the script are deliberate. `spawnSync` uses `shell: true` because on Windows `pnpm` resolves to `pnpm.cmd`, which Node refuses to spawn directly; the script names are hardcoded literals, never user input. And the job keeps `use_stdin: true`, because the script still reads the ref lines git feeds the hook in order to skip the checks when the push only deletes a remote branch.

The script is also exposed as `pnpm verify`, so a contributor can run the same gate by hand before pushing.

## Applies When

- The project tracks the `tooling` domain.
- `lefthook.yml` exists and its `pre-push` job holds an inline shell block (grep for `STDIN=$(cat)` or `grep -q "^(delete)"`), or the root `package.json` has no `verify` script, or `scripts/pre-push.ts` is absent. Still having the inline shell block is the starting state this intention migrates away from, not a skip reason.

## Do Not Apply When

- The project has no `lefthook.yml` and uses a different git hook manager — record as skipped with that reason.
- The project deliberately runs no pre-push checks at all — record as skipped.
- A human has explicitly decided to keep the inline shell hook after reviewing this intention — record as skipped with that reason.

## Observable Gaps

Work through each gap independently; skip any that is already closed.

1. **Pre-push script file** — signal: `scripts/pre-push.ts` does not exist.
   Copy the staged reference `scripts/pre-push.ts` verbatim. Do not rename it and do not inline it into `lefthook.yml`.
   Done when: `scripts/pre-push.ts` exists and `pnpm typecheck` passes.

2. **Quality check list** — signal: `QUALITY_CHECKS` in `scripts/pre-push.ts` names a script the project's root `package.json` does not define, or the project's pre-push shell block ran checks the list omits.
   Adapt the `QUALITY_CHECKS` array so every entry matches a root `package.json` script, keeping the order the old hook used. Do not add new checks the project was not already running.
   Done when: every `script` value in `QUALITY_CHECKS` exists in the root `package.json` `scripts` object.

3. **Root verify script** — signal: root `package.json` has no `verify` entry in `scripts`.
   Add `"verify": "tsx ./scripts/pre-push.ts"`, matching the staged reference. Do not touch the other scripts.
   Done when: `pnpm verify` resolves and runs the checks.

4. **Lefthook pre-push job** — signal: the `pre-push` job in `lefthook.yml` contains a multi-line `run:` block rather than a single command.
   Adapt the staged reference `lefthook.yml`: replace the block with `run: pnpm verify` and keep `use_stdin: true` on the job, since the script reads the push refs to detect a delete-only push. Leave the `commit-msg` job untouched.
   Done when: `rg 'STDIN=\$\(cat\)' lefthook.yml` returns nothing, the `pre-push` job's `run:` is `pnpm verify`, and `use_stdin: true` is still set.

5. **tsx availability at the root** — signal: `tsx` is not a root `devDependencies` entry, so `pnpm verify` cannot start.
   Add `tsx` to the root `devDependencies` at the version in the staged reference `package.json`. Do not change any other dependency.
   Done when: `pnpm verify` starts without a "tsx not found" error.

## Out of Scope

- The `commit-msg` / commitlint job in `lefthook.yml`.
- What `lint`, `typecheck` and `test` actually do — their scripts, configs and per-package behaviour are untouched.
- CI workflows: this is the local hook only, not the GitHub Actions quality gate.
- Other `scripts/` entries such as `lint-pr.ts`, and the `cli/` and `.boilerstone/cli/` commands.
- Lockfiles and generated artifacts.

## Reference Paths

- `scripts/pre-push.ts` — **copy**
- `lefthook.yml` — **adapt**
- `package.json` — **adapt**

## Validation

- `pnpm verify` runs the checks and exits non-zero when one of them fails.
- `lefthook.yml` contains no inline shell block under `pre-push`, and the job still sets `use_stdin: true`.
- `pnpm typecheck` passes.
- `pnpm lint` passes.
- A real `git push` triggers the hook and the checks run; a push that only deletes a remote branch prints the skip message and does not run them.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/cross-platform-pre-push --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
