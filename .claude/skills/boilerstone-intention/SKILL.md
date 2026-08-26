---
name: boilerstone-intention
description: Write one bounded migration intention for the current pull request. Use when the user asks to "write the migration intention (for this PR)", "add an intention", or "write the unreleased intention".
---

# Write a migration intention

This skill is a thin adapter. The canon lives in the **Intention authoring** section of `.boilerstone/docs/release-maintainer-runbook.md` and in `.boilerstone/migration-intentions/TEMPLATE.md` — read those first. Do not invent a different format.

## Preflight

1. Only run in the boilerplate repository itself (`.boilerstone/migration-intentions/` exists). In a consumer project this skill does not apply.
2. There is an open pull request (or a branch about to become one) that contains the code change.

## Job

Write **one** bounded intention for this PR:

1. Copy `TEMPLATE.md` to `.boilerstone/migration-intentions/unreleased/slug.md`.
2. No `NN-` prefix. The `id:` is `unreleased/slug`. Optional `pr:` for the pull request number.
3. Fill every required section from the template, especially **Why**. Domain / scope values live in `commitlint.config.ts` — do not copy the list.
4. Keep it narrow. One adaptation, not a whole release.

If this PR does not need a consumer-facing intention (refactor, boilerplate-internal CI), stop and tell the user to apply the `no-intention` label instead.

## Guardrails

- Do not write into `vX.Y.Z/` and do not assign `NN-`. That happens on the Release PR.
- Do not invent the Why. Ask if the diff does not make the decision obvious.
- Do not restate the domain list.
