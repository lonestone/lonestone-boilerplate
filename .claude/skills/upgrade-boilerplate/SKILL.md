---
name: upgrade-boilerplate
description: Apply boilerplate migration intentions to a project created from the Lonestone boilerplate. Use when the user asks to "upgrade boilerplate", "sync boilerplate", "apply migration intentions", "mettre à jour le boilerplate", or mentions moving to a newer boilerplate version. State lives in .boilerstone/boilerplate.json.
---

# Upgrade boilerplate

This skill is a thin adapter. The canonical, executor-neutral workflow lives in `.boilerstone/docs/upgrade-runbook.md` — read it first and follow it exactly. Do not improvise a different process.

## Preflight

1. If `.boilerstone/` does not exist, the project is detached from the upgrade system — tell the user and stop.
2. If `git remote get-url origin` contains `lonestone-boilerplate`, this IS the boilerplate repository, not a consumer project — refuse and explain.
3. Ensure the worktree is clean before preparing anything.

## Quick map

```bash
pnpm boilerplate upgrade status --json            # Current state (version, applied/skipped)
pnpm boilerplate upgrade path --to <ver> --json   # Pending intentions and target branch
pnpm boilerplate upgrade prepare --to <ver>       # Builds .boilerstone/upgrade/ workspace
```

Then execute `.boilerstone/upgrade/upgrade-session.md`: one intention at a time, applicability checks first, smallest safe change, validation, then record the result in `.boilerstone/boilerplate.json` and commit (one commit per intention).

## Guardrails (from the runbook — non-negotiable)

- Never push, merge, or stash automatically
- Stop before editing on `breaking-manual` intentions; ask the human
- Stop on unsafe ambiguity and write `.boilerstone/upgrade/blocked.md`
- Preserve project-specific behavior; never rewrite divergent files wholesale
- Do not mark an intention applied before its validation passes
