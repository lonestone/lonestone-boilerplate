# How the upgrade system works

Start here. This page explains _why_ the system exists and _what each command does_, in plain terms. For the step-by-step you follow during an actual upgrade, see [upgrade-runbook.md](./upgrade-runbook.md).

## The problem

A project generated from this boilerplate **diverges from day one**. After the first `pnpm rock`, the code is yours: routes, models, business logic. When the boilerplate later improves something — a lint rule, an auth pattern, a CI step — you **can't merge that change as a diff**. A diff would land on top of code that has moved on, and clobber your work. The usual "fork and pull from upstream" model simply doesn't apply.

## The idea: ship meaning, not diffs

So the boilerplate doesn't ship diffs. Each release ships **migration intentions** — short markdown files that describe the _meaning_ of a change:

- **Goal** — the end state to reach.
- **Why** — the reason it exists.
- **Applies when / Do not apply when** — when to act, and when to skip.
- **Reference paths** — which files to look at to understand the change.

An **executor** — you, or an AI agent — reads an intention and **replays the smallest safe equivalent change** in your project, keeping your behavior intact.

> In one line: the boilerplate _declares_ knowledge; your project _executes_ it locally.

This is why the system is just markdown and JSON. It doesn't care whether the executor is a human, Claude, or another tool.

## The three moving pieces

- **`boilerplate.json`** — the only state committed to your repo. It records the boilerplate version/commit you started from and which intentions you've applied or skipped.
- **Migration intentions** — published per release, fetched from the boilerplate's git tags.
- **The CLI** (`pnpm boilerplate …`) — reads your state, computes what's left to do, and stages the work. It never edits your application code itself.

## Where the upgrade material comes from

Everything travels over plain git from a single URL: `source.remote` in your `boilerplate.json`, recorded at init (`BOILERPLATE_REPO` env for a fork or private mirror, the public GitHub repository by default). `upgrade prepare --fetch` pulls the boilerplate's release tags into a dedicated ref namespace — `refs/boilerstone/v*` — never into your own `refs/tags`: your project stays free to version its own app with its own `v*` tags and changelog, with zero risk of collision. No named remote is required, and from there everything is local: intentions are read from the fetched releases, reference trees and each intention's declared reference paths are extracted with `git archive`. No API, no registry, no network beyond git; `upgrade status` prints the exact fetch command whenever releases are missing.

## The commands, in the order you meet them

**`bootstrap`** — wires an _existing_ project into the system: adds the `boilerplate` script, ignores the scratch workspace, and records your starting version. Run once, when adopting the system on a project that predates it. (New projects get this through `pnpm rock` instead.)

**`upgrade status`** — answers "where am I, and am I ready?": your current version, the intentions already applied or skipped, plus readiness checks — state file valid, worktree clean, release tags available. It only reports and prints the commands to fix anything missing — it changes nothing.

**`versions list`** — lists the boilerplate versions available to you (from fetched tags). Read-only.

**`upgrade path --to <version>`** — answers "what would change?": computes the intentions between your version and the target, filtered to the domains you track and minus what you've already resolved. Read-only — it prints the plan and stops.

**`upgrade prepare --to <version>`** — builds the workspace for the upgrade. This is the first command that touches your repo, and only in contained ways:

1. it refuses if your worktree is dirty;
2. it creates and switches to a dedicated branch `upgrade/v<current>-to-v<target>`;
3. it writes a disposable, gitignored `.boilerstone/upgrade/` folder containing the intentions to process, the `.boilerstone` reference trees at both versions, the app-code reference paths the intentions declare (extracted at the target version), and a session prompt.

It does **not** edit your application code, commit, or push. Use `--to latest` to target the newest release, and `--fetch` to pull the release tags first.

After `prepare`, the actual work begins — applying the staged intentions one at a time, with one commit each. That procedure is the [runbook](./upgrade-runbook.md).

**`upgrade record`** — records a validated intention outcome in `boilerplate.json`. Use it instead of editing the JSON by hand.

**`upgrade finish`** — updates `source.currentVersion` after every intention in the prepared range is applied or skipped. This is the final upgrade commit, never an intermediate step.

## What ends up on your repo

- `boilerplate.json` — committed, small, the source of truth for your progress.
- a `upgrade/v…-to-v…` branch — created by `prepare`, yours to review or delete.
- `.boilerstone/upgrade/` — scratch space, gitignored, safe to delete anytime.

Nothing is applied automatically. An upgrade is always: stage it, then review and apply it yourself (or hand the session to an agent), commit by commit. To back out completely: switch off the branch, delete it, and remove `.boilerstone/upgrade/`.
