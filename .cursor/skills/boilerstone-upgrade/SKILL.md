---
name: boilerstone-upgrade
description: Apply boilerplate migration intentions to a project created from the Lonestone boilerplate. Use when the user asks to "upgrade boilerplate", "sync boilerplate", "apply migration intentions", "mettre à jour le boilerplate", or mentions moving to a newer boilerplate version. State lives in .boilerstone/boilerplate.json.
---

# Upgrade boilerplate

This skill is a thin adapter. The canonical, executor-neutral workflow lives in `.boilerstone/docs/upgrade-runbook.md` — read it first and follow it exactly. Do not improvise a different process.

The expected workflow is human-in-the-loop: the developer pilots you, and you use the CLI, git, tests, and migration intention files as tools. Do not run upgrades as an autonomous background process.

## Preflight

1. If `.boilerstone/` does not exist, the project is detached from the upgrade system — tell the user and stop.
2. If this is the boilerplate repository itself, do not apply consumer upgrades. You may still use `--project <consumer-path>` from this checkout to onboard or inspect a separate project.
3. Ensure the consumer worktree is clean before preparing anything.

## Quick map

```bash
pnpm boilerplate upgrade status --json
pnpm boilerplate upgrade path --to <ver> --json
pnpm boilerplate upgrade prepare --to <ver> --include <ids>  # omit --include for all; no TTY = no prompt
pnpm boilerplate upgrade record --id <id> --applied
pnpm boilerplate upgrade finish --to <ver>
```

## Required first step after prepare: propose apply / skip

Before editing anything or recording any skip, read every pending intention in `.boilerstone/upgrade/upgrade-session.md`, inspect the project, and present a proposal table to the human:

| Intention | Proposal | Why (one observable signal) |
|---|---|---|
| `vX.Y.Z/slug` | **apply** / **skip** / **ask** | … |

Wait for confirmation. Then execute only the confirmed plan (one intention at a time unless the human allows a small batch).

**Never** treat the starting stack an intention migrates away from as a skip reason (ESLint/Prettier → apply oxlint; Better Auth `pg` pool → apply MikroORM adapter; MikroORM below v7 → apply v7; missing Knip → apply Knip). Soft skips (optional domain unused, e.g. no AI) still need human confirmation before `upgrade record --skipped`.

Then follow the runbook: smallest safe change, validation, `upgrade record`. Commit after each intention for risky upgrades; for small supervised batches, multiple recorded intentions may be committed together after validation. Use `upgrade finish` only after every staged intention is applied or skipped.

## Guardrails

- Propose apply/skip first; never auto-skip or auto-apply without human confirmation.
- Never push, merge, or stash automatically.
- Stop before editing on `breaking-manual` intentions; ask the human.
- Stop on unsafe ambiguity and write `.boilerstone/upgrade/blocked.md`.
- Preserve project-specific behavior; never rewrite divergent files wholesale.
- Do not mark an intention applied before validation passes.
