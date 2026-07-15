# Piloting the upgrade system

> Maintainer note (producer-only; removed from consumer projects). How to validate the workflow on a real project before relying on it widely. The system is at pilot stage: one intention exists and no release-to-release migration has been proven yet.

## Choosing a pilot

Pick a project that was generated from an older boilerplate version, has diverged in real ways (custom features, local modifications), is not critical production, and exercises a representative slice of the stack (API, frontend, CI). The point is to surface where intentions are too vague or where an executor would damage project-specific code — a pristine project teaches you nothing.

## Running it

Follow the normal flow on the pilot: `bootstrap` (or `upgrade init`), then `upgrade status`, `upgrade path --to <target>`, and `upgrade prepare`. Then execute the staged intentions per the [runbook](./upgrade-runbook.md) — yourself, or by handing `.boilerstone/upgrade/upgrade-session.md` to the `boilerstone-upgrade` agent with permission to edit and commit.

## What to watch

- **Detection** — did `init` infer the right source version, and were the tracked domains appropriate?
- **The plan** — was the resolved path explainable? Were the pending intentions actually relevant to this project?
- **The intentions themselves** — precise enough? Were the applicability checks and stop conditions clear and correct? Were the reference files useful?
- **Execution** — did the executor follow the numbered order, use the target ref as source of truth, obey each path's `copy`/`adapt` policy, preserve project-specific behavior, keep changes minimal, commit atomically, and stop when it should have? Did `upgrade record` check the matching session item? Were skips justified with clear reasons?
- **Safety** — did the clean-worktree check, atomic workspace publication, dedicated branch, existing-workspace protection, and no-auto-push rules hold? Did an incomplete target fail before mutation, and was partial execution progress preserved?

## After the pilot

Turn the friction into fixes: sharpen unclear intentions (especially "Do not apply when"), adjust domain filtering, and improve validation where it tripped on project-specific setup. The recurring failure modes are an executor overwriting project code (tighten the intention's preservation guidance) and validation failing on a project-specific setup (make checks conditional). Capture what worked before widening to more projects.
