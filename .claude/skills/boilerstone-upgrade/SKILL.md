---
name: boilerstone-upgrade
description: Apply boilerplate migration intentions to a project created from the Lonestone boilerplate. Use when the user asks to "upgrade boilerplate", "sync boilerplate", "apply migration intentions", "mettre à jour le boilerplate", or mentions moving to a newer boilerplate version. State lives in .boilerstone/boilerplate.json.
---

# Upgrade boilerplate

This skill is a thin adapter. The canonical, executor-neutral workflow lives in `.boilerstone/docs/upgrade-runbook.md` — read it first and follow it exactly. Do not improvise a different process.

## Preflight

1. If `.boilerstone/` does not exist, the project is detached from the upgrade system — tell the user and stop.
2. If this is the boilerplate repository itself, do not apply consumer upgrades. You may still use `--project <consumer-path>` from this checkout to onboard or inspect a separate project.
3. Ensure the consumer worktree is clean before preparing anything.

## Quick map

```bash
pnpm boilerplate upgrade status --json            # State + readiness checks (version, applied/skipped, tags)
pnpm boilerplate upgrade path --to <ver> --json   # Pending intentions and target branch
pnpm boilerplate upgrade prepare --to <ver> --include <ids>  # Stage intentions (omit --include for all; no TTY = no prompt)
pnpm boilerplate upgrade record --id <id> --applied
pnpm boilerplate upgrade finish --to <ver>
```

Then execute `.boilerstone/upgrade/upgrade-session.md`: one intention at a time, applicability checks first, smallest safe change, validation, then record the result with `upgrade record`. Commit after each intention for risky upgrades; for small supervised batches, multiple recorded intentions may be committed together after validation. Use `upgrade finish` only after every staged intention is applied or skipped.

## Guardrails (from the runbook — non-negotiable)

- Never push, merge, or stash automatically
- Stop before editing on `breaking-manual` intentions; ask the human
- Stop on unsafe ambiguity and write `.boilerstone/upgrade/blocked.md`
- Preserve project-specific behavior; never rewrite divergent files wholesale
- Do not mark an intention applied before its validation passes
