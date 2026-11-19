---
id: unreleased/worktree-remove-promoted-intentions
domain: tooling
classification: migration
requires:
  - v1.5.0/worktree-commands
---

# Let worktree:remove recognise a squash-merged branch whose intention a release has promoted

## Goal

`pnpm worktree:remove <name>` treats a squash-merged branch as integrated even when a release has since moved the branch's unreleased intention to `vX.Y.Z/NN-<slug>.md`.

## Why

After a squash merge, `worktree:remove` compares each file the branch touches with `origin/main`. A branch that adds `unreleased/<slug>.md` touches a file that the next release moves to `vX.Y.Z/NN-<slug>.md`. The old path no longer exists in `origin/main`, so the script called the work not integrated and refused to remove the worktree ("not pushed"). That happens to nearly every branch that carries an intention.

The script now accepts that file when `origin/main` has `vX.Y.Z/NN-<slug>.md` with the same text, ignoring the `id:` line that the release rewrites.

## Applies When

- `scripts/worktree.ts` exists.
- `scripts/worktree.ts` has no `isPromotedIntention` function.

## Do Not Apply When

- The project has its own worktree tooling that does not come from the boilerplate.

## Observable Gaps

1. **Promoted intentions** — signal: `rg "isPromotedIntention" scripts/worktree.ts` finds nothing.
   Copy `isPromotedIntention`, `withoutIntentionId` and the two regular expressions above them from the staged reference, and call `isPromotedIntention` to filter the `touched` list in `isIntegrated`. Keep the project's own `ENV_FILES` and port settings.
   Done when: `pnpm exec tsc -p scripts/tsconfig.json` passes and `rg "isPromotedIntention" scripts/worktree.ts` matches.

## Out of Scope

- Anything else in `scripts/worktree.ts`.

## Reference Paths

- `scripts/worktree.ts` — **adapt**

## Validation

- In a worktree whose branch added an unreleased intention that a later release promoted, and whose pull request was squash-merged, `pnpm worktree:remove <name>` removes the worktree instead of saying the branch is not pushed.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/worktree-remove-promoted-intentions --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
