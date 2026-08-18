# Upgrade runbook

This is the procedure for applying a boilerplate upgrade to your project, once `upgrade prepare` has staged the work. It is the same for a human and for an AI agent — the `boilerstone-upgrade` skill follows this exact document. If you haven't read [how-it-works.md](./how-it-works.md) yet, read it first: it explains why intentions exist and what `prepare` produced.

Commands that accept `--json` emit machine-readable output; prefer it when the executor is a program.

## Before you start

You need a valid `.boilerstone/boilerplate.json` (run `upgrade init`, or `bootstrap` on an older project), a clean git worktree, no existing `.boilerstone/upgrade/` workspace, and the boilerplate releases available locally. `upgrade status` checks the state, worktree, and releases. Releases are fetched into the `refs/boilerstone/` namespace — never into your own tags, so they cannot collide with your app's versioning. If a workspace already exists, finish or deliberately remove it before preparing again; `prepare` never overwrites partial progress.

Then stage the upgrade:

```bash
pnpm boilerplate upgrade
```

That one command targets the latest release, refreshes publications when needed, and lets you choose the intentions interactively. A failed best-effort refresh can use an already available local publication with a warning; pass `--fetch` when refresh failure must stop preparation. You can skip `upgrade path`; the same resolution module computes the path internally. For explicit control:

```bash
pnpm boilerplate upgrade --to <version>
pnpm boilerplate upgrade prepare --to <version> --include v1.2.0/foo,v1.2.0/bar
pnpm boilerplate upgrade prepare --to <version> --exclude v1.2.0/optional-ai
```

This first builds and validates a temporary workspace. A missing target ref or missing `copy` path fails without creating a branch or publishing partial material. Once complete, it creates the `upgrade/v<source>-to-v<target>` branch and atomically publishes `.boilerstone/upgrade/`:

For an untagged producer draft, commit the release folder and intentions first and keep the producer's `.boilerstone/` clean — uncommitted changes there block preparation. `prepare` reads both intentions and references from that exact producer `HEAD`; it refuses working-tree-only draft content.

```
.boilerstone/upgrade/        # disposable, gitignored
  intentions/                # numbered intentions in execution order
  reference/README.md        # refs, provenance, and copy/adapt policy
  reference/source/          # source-ref projection, including declared app paths
  reference/target/          # target-ref projection, including declared app paths
  upgrade-session.md         # the session prompt / checklist
```

## Applying intentions

Work through `upgrade-session.md`. Agents must not decide apply/skip alone.

### 0. Propose the plan (agents — required before any edit or skip record)

1. Read every pending intention in the session checklist (goal, Applies When, Do Not Apply When, Observable Gaps).
2. Inspect the project for greppable signals (scripts, deps, configs, adapters).
3. Present a short table to the human:

   | Intention     | Proposal                       | Why (one observable signal) |
   | ------------- | ------------------------------ | --------------------------- |
   | `vX.Y.Z/slug` | **apply** / **skip** / **ask** | …                           |

4. **Anti-pattern (never do this):** treat the _starting stack_ the intention migrates away from as a skip reason.
   - Still on ESLint/Prettier → evidence to **apply** oxlint/oxfmt, not skip.
   - Still on Better Auth `pg` pool → evidence to **apply** the MikroORM adapter intention, not skip.
   - Still on MikroORM below v7 → evidence to **apply** the v7 migration, not skip.
5. Wait for the human to confirm or adjust the plan. Only then start work or record skips.
6. Soft / optional domains (e.g. no AI features → skip AI) may be proposed as skip, but still need human confirmation before `upgrade record --skipped`.

### 1. Apply one confirmed intention at a time

For each intention the human marked **apply**:

1. **Read it.** Note its `classification` and `domain` in the frontmatter, and understand the goal and the why.
2. **Re-check applicability.** If a hard "Do not apply when" now clearly matches (capability absent, different product entirely), stop and re-propose to the human — do not silently skip. If classification is `breaking-manual`, stop and get a human decision before touching anything. Intentions reference boilerplate paths (`apps/api/…`, root configs); if your project's layout differs, translate them to your structure — never reorganize the project to match the boilerplate.
3. **Understand the provenance.** Read `reference/README.md`. The target git ref is the source of truth; `reference/target/` is its disposable projection. Available app-code paths are staged from both source and target refs so the executor can distinguish a boilerplate change from a project-specific delta. If a path is missing, the session contains ready-made `git show`, `git archive`, and `git clone` commands.
4. **Follow the declared reference policy — never retype.** A `copy` path uses the target ref as its source of truth: copy the target projection verbatim and verify the diff. An `adapt` path requires a three-way comparison of project, source, and target: preserve project-specific deltas and apply only the source-to-target change. When the source projection is unavailable, preserve project behavior and use the target only as a reference. Manifest files (`package.json`, `pnpm-workspace.yaml`) are `adapt`, never `copy`.
5. **Validate.** Run the intention's own validation first, then the global checks that exist in your project: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. Report a missing script as unavailable, not as passing. For boilerplate-owned files, the diff against the staged reference must be empty — or every remaining delta must be project-specific and named in your summary.
6. **Record.** Only once validation passes, run `pnpm boilerplate upgrade record --id <id> --applied`. `boilerplate.json` remains the source of truth; the command checks the matching box in `upgrade-session.md` as a synchronized view. If that view cannot be updated after the state is saved, treat the warning as recoverable and do not retry the already-recorded outcome.

For each intention the human marked **skip**, record only after confirmation:

```bash
pnpm boilerplate upgrade record --id <id> --skipped --reason "…"
```

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

Stop — don't guess through — if validation keeps failing, if there's unsafe ambiguity, if applying the change would lose project-specific behavior, or if a hard "Do not apply when" match needs a human call you have not yet confirmed. When the executor is an agent, stopping means writing a short blocked report to `.boilerstone/upgrade/blocked.md` (intention id, reason, failed checks, suggested next step) and handing back to a human — **without** recording the intention or changing `source.currentVersion`. Never auto-skip an intention whose Observable Gaps are still open just because the project is still on the old stack.

## Git discipline

Stay on the dedicated `upgrade/…` branch. For risky or large upgrades, commit after each resolved intention. For small supervised batches, it is acceptable to record multiple intentions and commit them together after validation, as long as the PR summary still lists each applied/skipped intention. If an intention is half-applied and cannot be validated, revert only the uncommitted work for that intention, write `blocked.md`, and stop. Never stash, push, or merge automatically — those are the human's call. If the branch already exists, check it out manually before re-running `prepare`.

## Finishing

When every staged intention is applied or skipped, run `pnpm boilerplate upgrade finish --to <target-version>`, commit the final state, then open a PR. The CLI enforces this: `finish` resolves from local publications only and refuses while any intention in the range is neither applied nor skipped. Summarize what happened: intentions applied, intentions skipped (with reasons), anything blocked, and the validation results. Do not update `source.currentVersion` before this final step.
