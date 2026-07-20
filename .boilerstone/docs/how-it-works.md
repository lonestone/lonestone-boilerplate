# How the upgrade system works

Start here. This page explains _why_ the system exists and _what each command does_, in plain terms. For the step-by-step you follow during an actual upgrade, see [upgrade-runbook.md](./upgrade-runbook.md).

## The problem

A project generated from this boilerplate **diverges from day one**. After the first `pnpm rock`, the code is yours: routes, models, business logic. When the boilerplate later improves something — a lint rule, an auth pattern, a CI step — you **can't merge that change as a diff**. A diff would land on top of code that has moved on, and clobber your work. The usual "fork and pull from upstream" model simply doesn't apply.

## The idea: ship meaning, not diffs

So the boilerplate doesn't ship diffs. Each release ships **migration intentions** — short markdown files that describe the _meaning_ of a change:

- **Goal** — the end state to reach.
- **Why** — the reason it exists.
- **Applies when / Do not apply when** — signals for the executor; agents **propose** apply/skip to a human rather than deciding alone. Prior stacks the intention migrates away from are never skip reasons.
- **Reference paths** — which files to look at to understand the change.

An **executor** — you, or an AI agent — reads an intention and **replays the smallest safe equivalent change** in your project, keeping your behavior intact.

> In one line: the boilerplate _declares_ knowledge; your project _executes_ it locally.

This is why the system is just markdown and JSON. It doesn't care whether the executor is a human, Claude, or another tool.

## The three moving pieces

- **`boilerplate.json`** — the only state committed to your repo. It records the boilerplate version/commit you started from and which intentions you've applied or skipped. The CLI validates it against the declared schema invariants whenever it reads or writes it, persists versions without a leading `v`, and persists intention IDs as `vX.Y.Z/...` (legacy IDs without `v` are migrated automatically). Fields and domains introduced by a newer release are preserved with a warning rather than rejected, so an older vendored CLI keeps working across version skew; `schemaVersion` is the hard compatibility gate.
- **Migration intentions** — published per release, fetched from the boilerplate's git tags.
- **The CLI** (`pnpm boilerplate …`) — reads your state, computes what's left to do, and stages the work. It never edits your application code itself.

## Where the upgrade material comes from

Everything travels over plain git from a single URL: `source.remote` in your `boilerplate.json`, recorded at init (`BOILERPLATE_REPO` env for a fork or private mirror, the public GitHub repository by default). `upgrade prepare --fetch` pulls the boilerplate's release tags into a dedicated ref namespace — `refs/boilerstone/v*` — never into your own `refs/tags`: your project stays free to version its own app with its own `v*` tags and changelog, with zero risk of collision. Plain application tags never qualify as Boilerstone publications. No named remote is required, and from there everything is local: intentions are read from the fetched releases, reference trees and each intention's declared reference paths are extracted with `git archive`. No API, no registry, no network beyond git; `upgrade status` prints the exact fetch command whenever releases are missing.

## The commands, in the order you meet them

**`bootstrap`** — wires an _existing_ project into the system: adds the `boilerplate` script, ignores the scratch workspace, and records your starting version. Run once, when adopting the system on a project that predates it. (New projects get this through `pnpm rock` instead.)

**`upgrade status`** — answers "where am I, and am I ready?": your current version, the intentions already applied or skipped, plus readiness checks — state file valid, worktree clean, release tags available. It only reports and prints the commands to fix anything missing — it changes nothing.

**`versions list`** — lists the boilerplate versions available to you (from fetched tags). Read-only.

**`upgrade path --to <version>`** — answers "what would change?": computes the intentions between your version and the target, filtered to the domains you track and minus what you've already resolved. It is strictly local unless `--fetch` is passed; with `--fetch`, refreshing publications is required and a fetch failure stops the command. An explicit unknown target always fails instead of producing an empty path. Read-only — it prints the plan and stops.

**`upgrade prepare --to <version>`** — builds the workspace for the upgrade. This is the first command that touches your repo, and only in contained ways:

1. it refuses if your worktree is dirty or an upgrade workspace already exists;
2. it resolves the path and intention selection before mutating the project;
3. it builds a complete workspace in a temporary directory and refuses a missing target ref or missing `copy` path;
4. only after validation, it creates or confirms the dedicated branch `upgrade/v<current>-to-v<target>` and atomically publishes `.boilerstone/upgrade/` with numbered intentions, source and target projections, provenance, `copy`/`adapt` policy, and a session checklist.

The fetched target ref remains the source of truth; the projected files only make human and AI review convenient. While a maintainer tests an untagged local release, the producer checkout's committed `HEAD` is the temporary source of truth for both intentions and references; the draft must already be committed there, and uncommitted changes under the producer's `.boilerstone/` block preparation. A consumer never falls back to its own `HEAD`.

It does **not** edit your application code, commit, or push. The everyday form is simply `pnpm boilerplate upgrade`: it targets the latest release, refreshes publications when needed (falling back to an available local publication with a warning), and offers interactive intention selection on a terminal. `--fetch` makes that refresh mandatory; an explicit target without `--fetch` can remain entirely local when already available.

After `prepare`, the actual work begins — applying the staged intentions one at a time, with one commit each. That procedure is the [runbook](./upgrade-runbook.md).

**`upgrade record`** — records a validated intention outcome in `boilerplate.json`, then synchronizes the matching checkbox in the prepared session. The JSON remains the source of truth; if checklist synchronization fails after the atomic state write, the command succeeds with a recoverable warning instead of asking you to record the outcome again.

**`upgrade finish`** — updates `source.currentVersion` after every intention in the prepared range is applied or skipped. This is the final upgrade commit, never an intermediate step — resolution is local-only and fails closed while any intention in the range is neither applied nor skipped, or while the target release is not available locally.

## Tutorial: running an upgrade with an AI agent

The protocol is executor-neutral, but the supported path ships with the system: onboarding copies a `boilerstone-upgrade` skill for Claude Code (`.claude/skills/`) and Cursor (`.cursor/skills/`), both thin shims over the same runbook.

1. **Stage the upgrade** — run `pnpm boilerplate upgrade` yourself, or let the agent run it. This is the contained part described above: clean worktree required, dedicated branch, disposable workspace.
2. **Open an agent session in your project** — not in the boilerplate repository — and invoke the skill: `/boilerstone-upgrade` in Claude Code, or the `boilerstone-upgrade` skill in Cursor. It reads `.boilerstone/upgrade/upgrade-session.md` and follows the [runbook](./upgrade-runbook.md) exactly.
3. **What the agent does first** — read every pending intention, inspect the project, and **propose** apply / skip / ask for each (with one observable signal). Prior stacks the intention migrates away from (ESLint, Better Auth `pg` pool, MikroORM below v7, missing Knip, …) are evidence to **apply**, never to skip. Wait for your confirmation before editing or recording skips.
4. **Then one confirmed intention at a time** — follow each reference path's declared `copy`/`adapt` policy (diff first, never retype), run the intention's validation plus your project's global checks, then `pnpm boilerplate upgrade record`, one commit per intention (or a small supervised batch).
5. **Where it must stop** — `breaking-manual`, failing validation, unsafe ambiguity, or a skip/apply call you have not confirmed. Stopping means writing `.boilerstone/upgrade/blocked.md` and handing back to you, without recording anything.
6. **Your job** — confirm the proposal table, review each commit like a PR, answer the stops, and once everything in the range is applied or skipped, run `pnpm boilerplate upgrade finish --to <version>` and open the PR. The CLI refuses a premature finish, so a runaway session cannot silently mark the upgrade done.

Any other agent works the same way: point it at `.boilerstone/upgrade/upgrade-session.md` (the staged session prompt) and the [runbook](./upgrade-runbook.md) — markdown, JSON and git are the whole interface, and the commands that matter accept `--json`.

## What ends up on your repo

- `boilerplate.json` — committed, small, the source of truth for your progress.
- a `upgrade/v…-to-v…` branch — created by `prepare`, yours to review or delete.
- `.boilerstone/upgrade/` — scratch space, gitignored, safe to delete anytime.

Nothing is applied automatically. An upgrade is always: stage it, then review and apply it yourself (or hand the session to an agent), commit by commit. To back out completely: switch off the branch, delete it, and remove `.boilerstone/upgrade/`.
