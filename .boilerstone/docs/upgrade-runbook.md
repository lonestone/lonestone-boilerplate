# Upgrade runbook

This is the procedure for applying a boilerplate upgrade to your project, once `upgrade prepare` has staged the work. It is the same for a human and for an AI agent — the `upgrade-boilerplate` skill follows this exact document. If you haven't read [how-it-works.md](./how-it-works.md) yet, read it first: it explains why intentions exist and what `prepare` produced.

Commands that accept `--json` emit machine-readable output; prefer it when the executor is a program.

## Before you start

You need a valid `.boilerstone/boilerplate.json` (run `upgrade init`, or `bootstrap` on an older project), a clean git worktree, and the boilerplate release tags available locally. `upgrade doctor` checks all three and prints the exact `git remote add` / `git fetch --tags` commands when tags are missing — references can only be extracted from tags that exist locally.

Then stage the upgrade:

```bash
pnpm boilerplate upgrade prepare --to <version>   # or --to latest --fetch
```

This creates the `upgrade/v<source>-to-v<target>` branch and the `.boilerstone/upgrade/` workspace:

```
.boilerstone/upgrade/        # disposable, gitignored
  intentions/                # the intentions to process, one file each
  reference/source/          # .boilerstone tree at the source tag
  reference/target/          # .boilerstone tree at the target tag
  upgrade-session.md         # the session prompt / checklist
```

## Applying one intention

Work through `upgrade-session.md` one intention at a time. For each:

1. **Read it.** Note its `classification` and `domain` in the frontmatter, and understand the goal and the why.
2. **Decide if it applies.** Check the "Applies when" and "Do not apply when" conditions against your project. If it doesn't apply, record it as skipped with a reason and move on. If its classification is `breaking-manual`, stop and get a human decision before touching anything.
3. **Understand the change** by comparing `reference/source/` with `reference/target/` (and, for app-code intentions, the boilerplate at the target tag). You're after the *meaning* of the change, not a literal copy.
4. **Make the smallest safe change.** Adapt your existing code; don't replace it wholesale. Preserve project-specific behavior. Avoid cosmetic edits.
5. **Validate.** Run the intention's own validation first, then the global checks that exist in your project: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. Report a missing script as unavailable, not as passing.
6. **Record and commit.** Only once validation passes, add the intention id to `intentions.applied` (with today's date) in `boilerplate.json`, and commit — **one commit per intention** (`feat: apply migration intention <id>`).

Recorded outcomes look like this:

```json
{
  "intentions": {
    "applied": [{ "id": "v1.6.0/add-s3-module", "appliedAt": "2026-04-30" }],
    "skipped": [{ "id": "v1.6.0/web-ssr-monitoring", "reason": "Project does not use web-ssr" }]
  }
}
```

## When to stop

Stop — don't guess through — if a "Do not apply when" condition matches, if validation keeps failing, if there's unsafe ambiguity, or if applying the change would lose project-specific behavior. When the executor is an agent, stopping means writing a short blocked report to `.boilerstone/upgrade/blocked.md` (intention id, reason, failed checks, suggested next step) and handing back to a human — **without** updating `boilerplate.json`.

## Git discipline

Stay on the dedicated `upgrade/…` branch with one commit per resolved intention. Keep successful commits even if a later intention fails. Never stash, push, or merge automatically — those are the human's call. If the branch already exists, check it out manually before re-running `prepare`.

## Finishing

When every intention is applied or skipped, set `source.currentVersion` to the target version in `boilerplate.json` as the final commit, then open a PR. Summarize what happened: intentions applied, intentions skipped (with reasons), anything blocked, and the validation results.
