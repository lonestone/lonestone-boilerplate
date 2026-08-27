---
name: boilerstone-release
description: Prepare a Lonestone boilerplate release on the release-please Release PR — promote staged intentions, check staleness, draft the release note, run validations. Use when the maintainer asks to "prepare the release", "work the Release PR", "release the boilerplate", or "préparer une release du boilerplate". Only valid inside the boilerplate repository itself. Never tags. Never merges.
---

# Release boilerplate

This skill is a thin adapter. The canonical procedure lives in `.boilerstone/docs/release-maintainer-runbook.md` — read it first and follow it exactly. Do not improvise a different process.

You operate on the **release-please Release PR** (label `autorelease: pending`) when it exists. The version and `CHANGELOG.md` are already there. The human is a plumber; authors already wrote intentions in `unreleased/`.

If there is **no** Release PR yet, you may still draft `apps/documentation/src/content/docs/releases/vX.Y.Z.mdx` on a regular PR (see the runbook section "Drafting the release note"). Do not promote intentions, tag, or merge in that case.

## Preflight

1. Only run in the boilerplate repository itself (`.boilerstone/migration-intentions/` exists). In a consumer project this skill does not apply — point the user to `project-release` or `boilerstone-upgrade`.
2. If a Release PR is open, read the next version from `.release-please-manifest.json` on that branch. If it is not open, dry-run release-please for the version and draft the note only. Do not pick a version by gut feel.
3. **Never tag. Never merge the Release PR.** Those are the human's final act. release-please creates the tag after merge.

## Quick map

```bash
git tag --list 'v*' --sort=-v:refname                          # previous version
# CHANGELOG.md is generated — do not edit it
pnpm boilerplate intentions promote --to X.Y.Z                 # unreleased/ → vX.Y.Z/NN-slug.md, ids rewritten
git diff --name-status vPREVIOUS..HEAD                         # staleness-check intentions against the diff
# draft apps/documentation/src/content/docs/releases/vX.Y.Z.mdx
# Intention promote CI fails until unreleased/ has been promoted (error is the command)
pnpm boilerplate intentions sync                                # regenerate the release README intentions block
pnpm boilerplate intentions lint                                # validate published intention metadata
pnpm boilerplate upgrade path --from <prev> --to <next> --json  # dry-run the resulting path
```

Then smoke-test as a consumer (see the runbook) and stop.

## Guardrails (from the runbook — non-negotiable)

- Never one vague intention for a whole release; never force optional capabilities on consumers.
- Never an unbounded "update dependencies" step.
- Keep Reference Paths small and specific, and label every path `copy` or `adapt`.
- Do not edit `CHANGELOG.md` by hand. Do not `git tag`. Do not merge.
- Promote last: release-please force-pushes the Release PR on every push to `main`. If the branch was rewritten after you promoted, re-run promote.
- Domain / scope values live in `commitlint.config.ts` — do not restate the list.
