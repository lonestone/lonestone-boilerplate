---
id: unreleased/format-at-commit
domain: tooling
classification: migration
requires:
  - unreleased/install-lefthook-hooks
  - unreleased/ci-fmt-check-quiet-hooks
---

# Format staged files at commit and fail when the hooks are missing

## Goal

A pre-commit hook formats the staged files with Oxfmt, and a commit fails when lefthook is not installed in the worktree.

## Why

An agent once ran `pnpm exec prettier --write` on whole folders. Prettier was only a transitive dependency with no config in the repo, so it rewrote 32 files that already followed `.oxfmtrc.json`. Nothing stopped it. Formatting now happens at commit time, on the staged files only, with the project's own formatter.

In a worktree without `pnpm install`, the lefthook hook script found no binary and let the commit pass without any check. `assert_lefthook_installed: true` makes that case fail with a clear message instead.

The hook only reformats files that are staged. Files outside the index are never touched. It passes `--no-error-on-unmatched-pattern` so a staged file that Oxfmt ignores (for example `CHANGELOG.md`) does not fail the commit.

## Applies When

- The project tracks the `tooling` domain.
- `lefthook.yml` exists and the project uses Oxfmt (`fmt` script and `.oxfmtrc.json`).
- `lefthook.yml` has no `pre-commit` hook that runs Oxfmt.

## Do Not Apply When

- The project has deliberately left Oxfmt.
- A human has decided to keep formatting out of the git hooks after reviewing this intention.

## Observable Gaps

1. **Pre-commit format hook** — signal: `lefthook.yml` has no `pre-commit` job that runs `oxfmt` on `{staged_files}`.
   Add the `pre-commit` job and the `assert_lefthook_installed: true` setting from the staged reference. Keep the project's own jobs, and the quiet output settings that `unreleased/ci-fmt-check-quiet-hooks` adds. Adjust the `glob` if the project formats other file types.
   Done when: `rg "assert_lefthook_installed" lefthook.yml` matches and `rg "oxfmt" lefthook.yml` matches.

2. **Hooks reinstalled** — signal: `.git/hooks/pre-commit` does not exist.
   Run `pnpm install` (or `pnpm run prepare`). The `prepare` script comes from `unreleased/install-lefthook-hooks`. Existing worktrees need this once, because the assertion is written into the hook script at install time.
   Done when: a badly formatted staged file is fixed by `git commit`.

3. **The rule in the agent and contributor docs** — signal: `AGENTS.md` (and `CLAUDE.md`, if the project keeps a copy) and `CONTRIBUTING.md` do not say that formatting happens at commit time.
   Add the one line from the staged references. Where `README.md` tells people to run `pnpm fmt`, replace it with the same message.
   Done when: `rg "never run a formatter" AGENTS.md CONTRIBUTING.md` matches.

## Out of Scope

- The Oxfmt and Oxlint rules, and the CI format check (see `unreleased/ci-fmt-check-quiet-hooks`).
- Reformatting existing files.
- Other hooks.

## Reference Paths

- `lefthook.yml` — **adapt**
- `AGENTS.md` — **adapt**
- `CONTRIBUTING.md` — **adapt**

## Validation

- Stage a badly formatted `.ts` file and commit it: the committed version is formatted.
- A file that is modified but not staged is left as it was.
- In a worktree without `pnpm install`, `git commit` fails and says that lefthook is not installed.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/format-at-commit --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
