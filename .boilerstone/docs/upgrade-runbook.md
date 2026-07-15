# Upgrade runbook

This is the procedure for applying a boilerplate upgrade to your project, once `upgrade prepare` has staged the work. It is the same for a human and for an AI agent — the `boilerstone-upgrade` skill follows this exact document. If you haven't read [how-it-works.md](./how-it-works.md) yet, read it first: it explains why intentions exist and what `prepare` produced.

Commands that accept `--json` emit machine-readable output; prefer it when the executor is a program.

## Before you start

You need a valid `.boilerstone/boilerplate.json` (run `upgrade init`, or `bootstrap` on an older project), a clean git worktree, and the boilerplate releases available locally. `upgrade status` checks all three and prints the exact fetch command when releases are missing. Releases are fetched into the `refs/boilerstone/` namespace — never into your own tags, so they cannot collide with your app's versioning.

Then stage the upgrade:

```bash
pnpm boilerplate upgrade
```

That one command targets the latest release, fetches it when needed, and lets you choose the intentions interactively. You can skip `upgrade path`; the path is computed internally. For explicit control:

```bash
pnpm boilerplate upgrade --to <version>
pnpm boilerplate upgrade prepare --to <version> --include v1.2.0/foo,v1.2.0/bar
pnpm boilerplate upgrade prepare --to <version> --exclude v1.2.0/optional-ai
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
2. **Decide if it applies.** Check the "Applies when" and "Do not apply when" conditions against your project. If it doesn't apply, record it as skipped with a reason and move on. If its classification is `breaking-manual`, stop and get a human decision before touching anything. Intentions reference boilerplate paths (`apps/api/…`, root configs); if your project's layout differs, translate them to your structure — never reorganize the project to match the boilerplate.
3. **Understand the change** by comparing `reference/source/` with `reference/target/`. The app-code paths each intention declares under "Reference Paths" are staged at the target version inside `reference/target/`; if you need a file that isn't staged, `upgrade-session.md` contains ready-made `git archive` / `git clone` commands to pull it from the target tag. You're after the _meaning_ of the change; the diff against the staged reference tells you where a literal copy is safe and where adaptation is needed.
4. **Diff first — never retype.** For each file the intention references, run `diff <file> .boilerstone/upgrade/reference/target/<file>` before editing. No project-specific delta → copy the staged reference verbatim. Project deltas → keep them and apply only the reference-side hunks. Manifest files (`package.json`, `pnpm-workspace.yaml`) are always merges, never copies: treat each dependency line as its own hunk, and only touch the lines the intention names. Elsewhere, make the smallest safe change and preserve project-specific behavior; avoid cosmetic edits.
5. **Validate.** Run the intention's own validation first, then the global checks that exist in your project: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. Report a missing script as unavailable, not as passing. For boilerplate-owned files, the diff against the staged reference must be empty — or every remaining delta must be project-specific and named in your summary.
6. **Record.** Only once validation passes, run `pnpm boilerplate upgrade record --id <id> --applied` (or `--skipped --reason "..."`).

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

Stop — don't guess through — if a "Do not apply when" condition matches, if validation keeps failing, if there's unsafe ambiguity, or if applying the change would lose project-specific behavior. When the executor is an agent, stopping means writing a short blocked report to `.boilerstone/upgrade/blocked.md` (intention id, reason, failed checks, suggested next step) and handing back to a human — **without** recording the intention or changing `source.currentVersion`.

## Git discipline

Stay on the dedicated `upgrade/…` branch. For risky or large upgrades, commit after each resolved intention. For small supervised batches, it is acceptable to record multiple intentions and commit them together after validation, as long as the PR summary still lists each applied/skipped intention. If an intention is half-applied and cannot be validated, revert only the uncommitted work for that intention, write `blocked.md`, and stop. Never stash, push, or merge automatically — those are the human's call. If the branch already exists, check it out manually before re-running `prepare`.

## Finishing

When every staged intention is applied or skipped, run `pnpm boilerplate upgrade finish --to <target-version>`, commit the final state, then open a PR. The CLI enforces this: `finish` refuses while any intention in the range is neither applied nor skipped. Summarize what happened: intentions applied, intentions skipped (with reasons), anything blocked, and the validation results. Do not update `source.currentVersion` before this final step.
