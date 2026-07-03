---
name: boilerstone-release
description: Publish a new Lonestone boilerplate release — inventory the changes, classify them, write migration intentions, update the changelog, and prepare the release tag. Use when the maintainer asks to "release the boilerplate", "publish a new version", "write migration intentions", or "préparer une release du boilerplate". Only valid inside the boilerplate repository itself.
---

# Release boilerplate

This skill is a thin adapter. The canonical procedure lives in `.boilerstone/docs/release-maintainer-runbook.md` — read it first and follow it exactly. Do not improvise a different process.

The expected workflow is human-in-the-loop: the maintainer pilots you, and you use git, the CLI, tests, and the intention template as tools.

## Preflight

1. Only run in the boilerplate repository itself (`.boilerstone/migration-intentions/` exists). In a consumer project (consumer-mode `.boilerstone/`), this skill does not apply — point the user to `boilerstone-upgrade` instead.
2. Never create or push the release tag yourself — that is the human's final step, after merge.

## Quick map

```bash
git tag --list 'v*' --sort=-v:refname                          # previous version
git diff --name-status vPREVIOUS..HEAD                          # inventory the changes
pnpm boilerplate intentions lint                                # validate intention metadata
pnpm boilerplate upgrade path --from <prev> --to <next> --json  # dry-run the resulting path
```

Write one intention per bounded adaptation from `.boilerstone/migration-intentions/TEMPLATE.md` — Observable Gaps (greppable signal, staged reference, binary "Done when") and Out of Scope are required sections. Classify every meaningful change: `no-migration`, `informational`, `migration`, or `breaking-manual`.

## Guardrails (from the runbook — non-negotiable)

- Never one vague intention for a whole release; never force optional capabilities on consumers.
- Keep Reference Paths small and specific — `upgrade prepare` stages them (no lockfiles, no generated artifacts).
- Update `CHANGELOG.md` and smoke-test install/onboard before handing back for the tag.
