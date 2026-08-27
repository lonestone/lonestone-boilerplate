# How the upgrade system works

Start here. This page explains why the system exists and what each command does. For the step-by-step you follow during an actual upgrade, see [upgrade-runbook.md](./upgrade-runbook.md).

## The problem

A project generated from this boilerplate diverges from day one. After the first `pnpm rock`, the code is yours: your routes, your models, your business logic. When the boilerplate later improves something — a lint rule, an auth pattern, a CI step — you can't merge that improvement as a diff. The diff would land on top of code that has moved on, and clobber your work. The usual "fork and pull from upstream" model simply doesn't apply.

## The idea: ship meaning, not diffs

So the boilerplate doesn't ship diffs. Each release ships **migration intentions**: short markdown files that describe what a change *means*, so that someone else can redo it in a different codebase:

- **Goal** — the end state to reach.
- **Why** — the reason the boilerplate changed.
- **Applies when / Do not apply when** — concrete signals for deciding whether the change concerns this project. Agents propose apply-or-skip and a human confirms; agents never decide alone.
- **Reference paths** — which files to compare to understand the change.

One decision mistake comes up often enough to call out here. Take an intention like "migrate from ESLint to oxlint": finding ESLint in the project doesn't mean the intention is irrelevant — ESLint is exactly what the intention is there to replace, so it's the signal to *apply*. Skip an intention only when the concern doesn't exist in the project at all (say, an AI-related intention in a project with no AI features).

Whoever runs the upgrade — you, or an AI agent — reads each intention and replays the smallest safe equivalent change in your project, keeping your behavior intact. The boilerplate declares the knowledge; your project executes it locally.

That's also why the whole system is plain markdown and JSON. It works the same whether the executor is a human, Claude, Cursor, or a tool that doesn't exist yet.

## The three moving pieces

- **`boilerplate.json`** — the only state committed to your repo. It records which boilerplate version you started from and which intentions you've applied or skipped.
- **Migration intentions** — published per release, fetched from the boilerplate's git tags.
- **The CLI** (`pnpm boilerplate …`) — reads your state, computes what's left to do, and stages the work. It never edits your application code itself.

A few state-file details that occasionally matter (skip this on first read): the CLI validates the file on every read and write, stores versions without a leading `v`, and stores intention IDs as `vX.Y.Z/slug` — old IDs without the `v` are migrated automatically. Fields and domains introduced by a newer release are kept with a warning rather than rejected, so an older vendored CLI keeps working across version skew. The one hard compatibility gate is `schemaVersion`.

## Onboarding

[`install.sh`](../../install.sh) is the single entry point for the whole lifecycle. It only needs `git` and `pnpm`. By default it resolves the latest published release tag and downloads that exact snapshot (a full clone for a new project, a sparse checkout of `.boilerstone/` alone for onboarding).

```bash
curl -fsSL https://raw.githubusercontent.com/lonestone/lonestone-boilerplate/main/install.sh | sh -s -- init my-app
curl -fsSL https://raw.githubusercontent.com/lonestone/lonestone-boilerplate/main/install.sh | sh -s -- onboard
curl -fsSL https://raw.githubusercontent.com/lonestone/lonestone-boilerplate/main/install.sh | sh -s -- upgrade
curl -fsSL https://raw.githubusercontent.com/lonestone/lonestone-boilerplate/main/install.sh | sh -s -- upgrade 1.6.0
```

- **`init`** clones the template and runs `pnpm rock`.
- **`onboard`** fetches `.boilerstone/` and the `boilerstone-upgrade` skills into an existing project, runs `bootstrap` (below), then offers to commit (`[Y/n]`, default yes).
- **`upgrade [version]`** stages an upgrade workspace on a dedicated branch. It never edits your app code, commits, or pushes — applying intentions is a separate step ([runbook](./upgrade-runbook.md)).

`--ref latest` is the default; pin with `--ref vX.Y.Z`. Branch refs like `main` are rejected so a project never starts from unreleased code. For a fork or private mirror, set `BOILERPLATE_REPO=<url>` — that repository must publish compatible `vX.Y.Z` tags.

`bootstrap` adds the `boilerplate` script and a `tsx` devDependency, gitignores `.boilerstone/upgrade/`, switches `.boilerstone/` to consumer mode, and initializes tracking. It's idempotent and never overwrites what's already there. It deliberately does **not** run `pnpm rock` — that script renames packages, rewrites leftover `@boilerstone/` imports, and rewrites env/docker files, which is fine on a fresh template and destructive on a real project.

> **Heads-up on v1.0.0:** its intentions are baseline catch-ups ("align with the v1.0.0 …"), broader than the narrow deltas later releases ship. When onboarding an older project, budget roughly one working session per intention.

Without the installer, `onboard` is:

```bash
git clone --depth 1 --filter=blob:none --sparse <repo> _bp && git -C _bp sparse-checkout set .boilerstone
mv _bp/.boilerstone .boilerstone && rm -rf _bp
rm -f .boilerstone/boilerplate.json   # drop the repo's own tracking state so init detects yours
pnpm dlx tsx .boilerstone/cli/boilerplate.ts bootstrap && pnpm install
```

## Where the upgrade material comes from

Everything travels over plain git, from a single URL: `source.remote` in your `boilerplate.json`, recorded at init. It points at the public GitHub repository by default; set the `BOILERPLATE_REPO` env variable at init to use a fork or private mirror.

`upgrade prepare --fetch` pulls the boilerplate's release tags into a dedicated namespace, `refs/boilerstone/v*` — never into your own `refs/tags`. Your project stays free to tag its own releases `v1.2.3` with zero risk of collision, and plain application tags are never mistaken for boilerplate releases.

From there everything is local: intentions are read from the fetched refs, and reference files are extracted with `git archive`. No API, no registry, no network beyond git. If a release is missing, `upgrade status` prints the exact fetch command to run.

## The commands, in the order you meet them

**`bootstrap`** — wires an *existing* project into the system (see [Onboarding](#onboarding)). New projects get all of this through `pnpm rock` instead.

**`upgrade status`** — answers "where am I, and am I ready?": your current version, the intentions already applied or skipped, and readiness checks (state file valid, worktree clean, release tags available). It changes nothing — it only reports, and prints the command to fix anything missing.

**`versions list`** — lists the boilerplate versions available to you, from fetched tags. Read-only.

**`upgrade path --to <version>`** — answers "what would change?": the intentions between your version and the target, filtered to the domains you track, minus what you've already resolved. Read-only — it prints the plan and stops. It works from local data unless you pass `--fetch`, in which case a failed fetch stops the command. Asking for a version the CLI doesn't know always fails loudly rather than printing an empty plan.

**`upgrade prepare --to <version>`** — builds the workspace for the upgrade. This is the first command that touches your repo, and it's deliberately paranoid about how:

1. it refuses to run if your worktree is dirty or an upgrade workspace already exists;
2. it resolves the path and intention selection *before* changing anything;
3. it builds the complete workspace in a temporary directory first, and fails there if the target ref or a required `copy` path is missing;
4. only once everything checks out does it create (or confirm) the branch `upgrade/v<current>-to-v<target>` and publish `.boilerstone/upgrade/` in one move: numbered intentions, source and target file projections, provenance, the `copy`/`adapt` policy, and a session checklist.

So a failed `prepare` leaves no half-built workspace, and a re-run never overwrites progress. The fetched target ref remains the source of truth; the projected files just make review convenient.

`prepare` does not edit your application code, commit, or push. And day to day you won't type `prepare` at all: plain `pnpm boilerplate upgrade` targets the latest release, refreshes publications when needed (falling back to an available local publication with a warning), and offers interactive intention selection. Pass `--fetch` when a failed refresh should stop the command instead.

One wrinkle you can ignore unless you maintain the boilerplate itself: while testing a release that isn't tagged yet, the producer checkout's committed `HEAD` acts as the temporary source of truth for intentions and references. The draft must already be committed — uncommitted changes under the producer's `.boilerstone/` block preparation. A consumer project never falls back to its own `HEAD`.

After `prepare`, the actual work begins: applying the staged intentions one at a time, one commit each. That procedure is the [runbook](./upgrade-runbook.md).

**`upgrade record`** — records a validated intention outcome in `boilerplate.json`, then ticks the matching checkbox in the session checklist. The JSON is the source of truth; if the checkbox update fails after the state was saved, the command still succeeds with a warning — don't record the same outcome twice.

**`upgrade finish`** — bumps `source.currentVersion` once every intention in the prepared range is applied or skipped. It's the final commit of an upgrade, never an intermediate step: it works from local data only and refuses while anything in the range is still unresolved or the target release isn't available locally.

## Tutorial: running an upgrade with an AI agent

The protocol works with any executor, but the supported path ships with the system: onboarding copies a `boilerstone-upgrade` skill for Claude Code (`.claude/skills/`) and Cursor (`.cursor/skills/`), both thin shims over the same runbook.

1. **Stage the upgrade.** Run `pnpm boilerplate upgrade` yourself, or let the agent run it. This is the contained part described above: clean worktree required, dedicated branch, disposable workspace.
2. **Open an agent session in your project** — not in the boilerplate repository — and invoke the skill: `/boilerstone-upgrade` in Claude Code, or the `boilerstone-upgrade` skill in Cursor. It reads `.boilerstone/upgrade/upgrade-session.md` and follows the [runbook](./upgrade-runbook.md) exactly.
3. **The agent starts by proposing, not editing.** It reads every pending intention, inspects the project, and proposes apply / skip / ask for each, with one observable signal per call. Finding the pre-migration state in the project (ESLint still configured, Better Auth on a `pg` pool, MikroORM below v7, Knip missing, …) counts as evidence to **apply** the matching intention, never to skip it. The agent waits for your confirmation before editing anything or recording skips.
4. **Then one confirmed intention at a time.** For each: follow the declared `copy`/`adapt` policy for every reference path (diff first, never retype), run the intention's validation plus your project's global checks, then `pnpm boilerplate upgrade record`. One commit per intention, or a small supervised batch.
5. **Where it must stop.** A `breaking-manual` intention, failing validation, unsafe ambiguity, or a skip/apply call you haven't confirmed. Stopping means writing `.boilerstone/upgrade/blocked.md` and handing back to you, without recording anything.
6. **Your job.** Confirm the proposal table, review each commit like a PR, answer the stops, and once everything in the range is applied or skipped, run `pnpm boilerplate upgrade finish --to <version>` and open the PR. The CLI refuses a premature finish, so a runaway session can't silently mark the upgrade done.

Any other agent works the same way: point it at `.boilerstone/upgrade/upgrade-session.md` and the [runbook](./upgrade-runbook.md). Markdown, JSON, and git are the whole interface, and the commands that matter accept `--json`.

## What ends up in your repo

- `boilerplate.json` — committed, small, the source of truth for your progress.
- an `upgrade/v…-to-v…` branch — created by `prepare`, yours to review or delete.
- `.boilerstone/upgrade/` — scratch space, gitignored, safe to delete anytime.

Nothing is applied automatically. An upgrade is always: stage it, then review and apply it yourself (or hand the session to an agent), commit by commit. To back out completely: switch off the branch, delete it, and remove `.boilerstone/upgrade/`.
