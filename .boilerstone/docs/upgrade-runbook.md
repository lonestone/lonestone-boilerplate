# Upgrade runbook

This is the procedure for applying a boilerplate upgrade to your project once `upgrade prepare` has staged the work. It's the same document for a human and for an AI agent — the `boilerstone-upgrade` skill follows it word for word. If you haven't read [how-it-works.md](./how-it-works.md) yet, start there: it explains what intentions are and what `prepare` produced.

When the executor is a program, prefer the `--json` flag on commands that accept it.

## Definitions

- **Intention** (migration intention): a markdown file that describes one bounded adaptation — goal, why, when it applies, what to change, how to validate.
- **Publication**: a boilerplate release available locally (usually a fetched git tag under `refs/boilerstone/v*`).
- **Domain**: an area of the stack an intention belongs to (`tooling`, `api`, `auth`, `ai`, …). Your project tracks a subset; intentions outside that subset are filtered out.
- **Classification**: how actionable an intention is — `migration`, `breaking-manual`, `informational`, or `no-migration`.
- **Executor**: whoever applies the intention — a human, or an AI agent supervised by a human.
- **Producer / consumer**: the boilerplate repository publishes intentions (producer); a generated or onboarded project applies them (consumer).
- **Workspace**: the disposable `.boilerstone/upgrade/` directory created by `prepare` — numbered intentions, reference files, and the session checklist.
- **Projection**: a copy of selected files extracted from a source or target git ref into the workspace, so you can diff without checking out that ref.
- **Provenance**: which git refs the workspace material came from, and whether each path is `copy` (target is truth) or `adapt` (keep project-specific deltas).
- **Session**: `upgrade-session.md` — the checklist the executor works through.

## Before you start

You need four things, and `upgrade status` checks the first three for you:

- a valid `.boilerstone/boilerplate.json` (run `upgrade init`, or `bootstrap` on an older project);
- a clean git worktree;
- the boilerplate releases available locally — they're fetched into the `refs/boilerstone/` namespace, never into your own tags, so they can't collide with your app's versioning;
- no existing `.boilerstone/upgrade/` workspace. If one exists, finish it or deliberately remove it first; `prepare` never overwrites partial progress.

Then stage the upgrade:

```bash
pnpm boilerplate upgrade
```

That one command targets the latest release, refreshes publications when needed, and lets you choose the intentions interactively. If the refresh fails but a local publication exists, it continues with a warning; pass `--fetch` when a failed refresh must stop preparation instead. You don't need to run `upgrade path` first — the same resolution logic runs internally. For explicit control:

```bash
pnpm boilerplate upgrade --to <version>
pnpm boilerplate upgrade prepare --to <version> --include v1.2.0/foo,v1.2.0/bar
pnpm boilerplate upgrade prepare --to <version> --exclude v1.2.0/optional-ai
```

`prepare` builds and validates a temporary workspace first — a missing target ref or missing `copy` path fails without creating a branch or publishing anything partial. Once everything checks out, it creates the `upgrade/v<source>-to-v<target>` branch and publishes:

```
.boilerstone/upgrade/        # disposable, gitignored
  intentions/                # numbered intentions in execution order
  reference/README.md        # refs, provenance, and copy/adapt policy
  reference/source/          # source-ref projection, including declared app paths
  reference/target/          # target-ref projection, including declared app paths
  upgrade-session.md         # the session prompt / checklist
```

(Boilerplate maintainers testing an untagged draft: commit the release folder and intentions first, and keep the producer's `.boilerstone/` clean. `prepare` reads intentions and references from the producer's committed `HEAD` and refuses working-tree-only draft content. Consumers can ignore this.)

## Applying intentions

Work through `upgrade-session.md`. Agents must never decide apply/skip alone.

### 0. Propose the plan (agents — required before any edit or skip record)

1. Read every pending intention in the session checklist: goal, Applies When, Do Not Apply When, Observable Gaps.
2. Inspect the project for greppable signals (scripts, deps, configs, adapters).
3. Present a short table to the human:

   | Intention | Proposal | Why (one observable signal) |
   |---|---|---|
   | `vX.Y.Z/slug` | **apply** / **skip** / **ask** | … |

4. **Anti-pattern — never do this:** proposing "skip" because the project is still on the tool or pattern the intention replaces. That's backwards — replacing it is the whole point of the intention.
   - Still on ESLint/Prettier → evidence to **apply** oxlint/oxfmt, not skip.
   - Still on Better Auth `pg` pool → evidence to **apply** the MikroORM adapter intention, not skip.
   - Still on MikroORM below v7 → evidence to **apply** the v7 migration, not skip.
5. Wait for the human to confirm or adjust the plan. Only then start work or record skips.
6. Genuinely optional domains (say, a project with no AI features and an AI intention) may be proposed as skip, but even those need human confirmation before `upgrade record --skipped`.

### 1. Apply one confirmed intention at a time

For each intention the human marked **apply**:

1. **Read it.** Note its `classification` and `domain` in the frontmatter, and understand the goal and the why.
2. **Re-check applicability.** If a hard "Do not apply when" now clearly matches — the capability is absent, it's a different product entirely — stop and re-propose to the human; don't silently skip. If the classification is `breaking-manual`, stop and get a human decision before touching anything. Intentions reference boilerplate paths (`apps/api/…`, root configs); if your project's layout differs, translate the paths to your structure — never reorganize the project to match the boilerplate.
3. **Understand the provenance.** Read `reference/README.md`. The target git ref is the source of truth; `reference/target/` is just its disposable projection. App-code paths are staged from both the source and target refs, so you can tell a boilerplate change apart from a project-specific delta. If a path is missing, the session contains ready-made `git show`, `git archive`, and `git clone` commands.
4. **Follow the declared reference policy — never retype.** A `copy` path treats the target ref as the source of truth: copy the target projection verbatim and verify the diff. An `adapt` path needs a three-way comparison of project, source, and target: keep the project-specific deltas and apply only the source-to-target change. If the source projection is unavailable, preserve project behavior and use the target only as a reference. Manifest files (`package.json`, `pnpm-workspace.yaml`) are always `adapt`, never `copy`.
5. **Validate.** Run the intention's own validation first, then whatever global checks the project has: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. Report a missing script as unavailable, not as passing. For boilerplate-owned files, the diff against the staged reference must be empty — or every remaining delta must be project-specific and named in your summary.
6. **Record.** Only once validation passes: `pnpm boilerplate upgrade record --id <id> --applied`. This updates `boilerplate.json` (the source of truth) and ticks the matching box in `upgrade-session.md`. If the checkbox update fails after the state was saved, that's a recoverable warning — don't record the outcome again.

For each intention the human marked **skip**, record only after their confirmation:

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

Stop — don't guess through — when validation keeps failing, when there's unsafe ambiguity, when applying the change would lose project-specific behavior, or when a hard "Do not apply when" match needs a human call you haven't yet confirmed. For an agent, stopping means writing a short report to `.boilerstone/upgrade/blocked.md` (intention id, reason, failed checks, suggested next step) and handing back to the human — **without** recording the intention or changing `source.currentVersion`. And never auto-skip an intention whose Observable Gaps are still open just because the project is still on the old stack.

## Git discipline

Stay on the dedicated `upgrade/…` branch. For risky or large upgrades, commit after each resolved intention. For small supervised batches it's fine to record several intentions and commit them together after validation, as long as the PR summary still lists every applied and skipped intention. If an intention is half-applied and won't validate, revert only the uncommitted work for that intention, write `blocked.md`, and stop. Never stash, push, or merge automatically — those are the human's call. If the branch already exists, check it out manually before re-running `prepare`.

## Finishing

When every staged intention is applied or skipped, run `pnpm boilerplate upgrade finish --to <target-version>`, commit the final state, then open a PR. The CLI enforces the order: `finish` resolves from local publications only and refuses while anything in the range is still unresolved. Don't touch `source.currentVersion` before this final step.

In the PR, summarize what happened: intentions applied, intentions skipped (with reasons), anything blocked, and the validation results.
