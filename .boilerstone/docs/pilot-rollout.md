# Piloting the upgrade system

> Maintainer note (producer-only; removed from consumer projects).

No release-to-release upgrade has been executed against a real diverged project yet. Before relying on the system widely, run it on one pilot project and pay attention to where it hurts — that's what this page is for.

## Choosing a pilot

Pick a project that was generated from an older boilerplate version, has diverged in real ways (custom features, local modifications), is not critical production, and exercises a representative slice of the stack (API, frontend, CI). The goal is to surface intentions that are too vague, and places where an executor would damage project-specific code. A pristine project teaches you nothing.

## Running it

Follow the normal flow on the pilot: `bootstrap` (or `upgrade init`), then `upgrade status`, `upgrade path --to <target>`, and `upgrade prepare`. Then execute the staged intentions per the [runbook](./upgrade-runbook.md) — yourself, or by handing `.boilerstone/upgrade/upgrade-session.md` to the `boilerstone-upgrade` agent with permission to edit and commit.

## What to watch

- **Detection** — did `init` infer the right source version? Were the tracked domains appropriate?
- **The plan** — could you explain why each intention was in (or out of) the resolved path? Were the pending intentions actually relevant to this project?
- **The intentions themselves** — precise enough? Were the applicability checks and stop conditions clear and correct? Were the reference files useful?
- **Execution** — did the executor follow the numbered order, treat the target ref as the source of truth, obey each path's `copy`/`adapt` policy, preserve project-specific behavior, keep changes minimal, commit atomically, and stop when it should have? Did `upgrade record` tick the matching session item? Were skips justified with clear reasons?
- **Safety** — did the clean-worktree check, atomic workspace publication, dedicated branch, existing-workspace protection, and no-auto-push rules all hold? Did an incomplete target fail before anything was mutated, and did partial execution progress survive?

## After the pilot

Turn the friction into fixes: sharpen unclear intentions (especially "Do not apply when"), adjust domain filtering, and make validation conditional where it tripped on project-specific setup. Expect two recurring failure modes — an executor overwriting project code (tighten the intention's preservation guidance) and validation failing on a project-specific setup (make the check conditional). Write down what worked before widening to more projects.
