---
name: finalize-pr
description: Prepare a pull request for merge by writing the squash commit into the PR title and description. Use when the user asks to "finalize this PR", "finalize / merge this PR", "prepare for merge", or "prepare this PR for merge".
---

# Finalize pull request

This skill is a thin adapter. The canon lives at `CONTRIBUTING.md` — read it first and follow it. Do not invent a different commit or PR format.

You run on the author's machine. CI only checks. You compose nothing server-side.

## Preflight

1. There is an open pull request for the current branch (`gh pr view`).
2. Read `CONTRIBUTING.md` and `commitlint.config.ts` (types and scopes). Do not guess scopes.
3. **Never merge** the pull request. Finalization ends at `gh pr edit`. Merging afterwards is a human step, from any path (UI, `gh`, auto-merge).
4. **Intention-or-label** (boilerplate producer only). If `.boilerstone/migration-intentions/` exists, this PR must either add a file under `.boilerstone/migration-intentions/unreleased/` (not the README) or carry the `no-intention` label. Check with `gh pr view --json labels,files`. If neither is present, stop: tell the user to write an intention (the `boilerstone-intention` skill) or apply the label. Do not invent the intention content without asking.

## Job

Run the transformation in `CONTRIBUTING.md` (messy WIP commits → one curated squash commit):

1. Read the **full diff** (`gh pr diff`), not the WIP commit subjects. Subjects under-describe the result.
2. Decide the consumer-visible changes this PR lands. One primary change = the title. Each additional one = one unbulleted conventional paragraph in the description. Drop the rest of the WIP history — "wip", "fmt", tests-only, and fix-of-the-fix subjects do not ride along.
3. Set the **title** to a valid conventional header with a valid scope from `commitlint.config.ts`.
4. Write the **description** as the future commit body:
   - Rationale prose first: why this approach, what was rejected. Distill WIP commit *bodies* by judgment; do not concatenate subjects.
   - Then, after a blank line, one unbulleted conventional paragraph per extra consumer-visible change (`fix(api): …`).
   - No screenshots, checklists, or review chatter (those stay in comments).
5. Scan the title and description for accidental `BREAKING-CHANGE:`. Never write that token unless the user intends to force a major. Prefer `type(scope)!:` in the title for an intentional major.
6. Apply both with `gh pr edit --title "..." --body "..."`.

Wait for the **PR lint** check. If it fails, the error is the fix — edit and retry.

## Guardrails

- Do not copy WIP subjects into the description.
- Do not restate the type or scope lists; they live in `commitlint.config.ts`.
- Do not merge. Do not enable auto-merge unless the user explicitly asks, and even then they click merge.
