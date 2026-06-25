# Boilerplate Upgrade System — Architecture & Design Decisions

> Internal note for maintainers and reviewers. A plain-language map of *how* the
> `.boilerstone/` upgrade system works and *why* it is built this way. The
> consumer-facing entry point is [`../README.md`](../README.md); the executable
> workflow is [`upgrade-runbook.md`](./upgrade-runbook.md).

## The problem

A project generated from this template **diverges forever**. From the first
`pnpm rock`, the code belongs to the client, not to the boilerplate. So when the
boilerplate evolves, we **cannot merge the changes as code** — a diff would
clobber business logic. The classic "fork + merge upstream" model does not work.

## The core idea: ship *meaning*, not diffs

Each release publishes **migration intentions**: markdown files describing the
*meaning* of a change, not its diff. An intention states:

- **Goal** — the end state to reach
- **Why** — the reason the change exists
- **Applies when / Do not apply when** — applicability checks and stop conditions
- **Reference Paths** — which files to compare
- **Suggested Workflow / Validation / Record Result** — steps, checks, bookkeeping

An **executor** — a human developer *or* an AI agent — reads the intention and
**replays the smallest safe equivalent change** in the consumer project,
preserving project-specific behaviour.

> In one line: *the boilerplate declares knowledge; the project executes it locally.*

## How it works, end to end

```
PRODUCER (boilerplate repo)            CONSUMER (generated project)
───────────────────────────           ─────────────────────────────
release vX.Y.Z
  └─ writes intentions
  └─ git tag vX.Y.Z  ───────────┐
                                 │  (git fetch --tags)
                                 ▼
                     .boilerstone/boilerplate.json
                     { currentVersion, trackedDomains, applied[], skipped[] }
                                 │
   pnpm boilerplate upgrade status   → where am I?
   pnpm boilerplate upgrade doctor   → am I ready? (clean worktree, tags present…)
   pnpm boilerplate upgrade path     → what's between me and the target?  (read-only)
   pnpm boilerplate upgrade prepare  → build the workspace + dedicated branch
                                 │
                                 ▼
                 .boilerstone/upgrade/   (gitignored, disposable)
                   ├─ reference/source/   (.boilerstone tree at the source tag)
                   ├─ reference/target/   (.boilerstone tree at the target tag)
                   ├─ intentions/*.md     (the intentions to process)
                   └─ upgrade-session.md  (the prompt / checklist for the executor)
                                 │
        Executor (human OR AI agent), one intention at a time:
        applicability check → smallest safe change → validation → commit
        → record outcome in boilerplate.json (applied / skipped)
```

`path` computes and prints only — it changes nothing. `prepare` builds a
disposable workspace and creates a dedicated `upgrade/vX-to-vY` branch. The
actual edits are done by the executor, **one commit per intention**.

## Key concepts

**Four classifications** (frontmatter `classification:`) drive behaviour:

| Classification    | Effect on the plan                                  |
| ----------------- | --------------------------------------------------- |
| `no-migration`    | nothing to do — dropped from the plan               |
| `informational`   | useful context, no action — dropped from the plan   |
| `migration`       | transferable evolution — **to apply**               |
| `breaking-manual` | **STOP**: human decision required before any edit   |

**Domains** (`tooling`, `api`, `frontend`, `ci`, `docker-env`, …) let a project
opt out of areas it doesn't use: intentions whose domain isn't in
`trackedDomains` are filtered out automatically.

**State file** — `.boilerstone/boilerplate.json` is the only committed state:
source version + the lists of applied/skipped intention IDs. Validated by
`boilerplate.schema.json`.

## Producer vs consumer (the same directory, two modes)

- **In the boilerplate repo**: everything is present — published intentions,
  the CLI, tests, internal docs.
- **In a generated project**: `pnpm rock` runs `cleanupBoilerplateFiles()`
  ([`cli/setup.ts`](../../cli/setup.ts)), which **removes the producer side**
  (`migration-intentions/`, internal docs, `boilerplate.example.json`) and
  **keeps** the local state, CLI, schema and runbook. Future-release intentions
  are then read **from git tags**, not from disk.

This is why `getReleases()` reads **git tags first**: a project forked at an old
version doesn't have newer files on disk, but the tag does. (A disk fallback
covers releases drafted in the boilerplate repo but **not yet tagged** — this is
load-bearing today, since no real release tags exist yet.)

## CLI commands

| Command            | Role                                                       |
| ------------------ | ---------------------------------------------------------- |
| `versions list`    | list available boilerplate versions (from tags / disk)    |
| `upgrade init`     | create `boilerplate.json` (detects source version)        |
| `upgrade doctor`   | diagnose readiness (state, clean worktree, tags, cleanup)  |
| `upgrade path`     | compute the plan to a target version (read-only)          |
| `upgrade prepare`  | build `.boilerstone/upgrade/` + the dedicated branch      |
| `upgrade status`   | show current state (version, applied/skipped)             |

`--json` is available on `status`, `path`, and `doctor` for agents/scripts.

## Design decisions (and why)

| Decision                                   | Why                                                                                      |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Intentions = meaning, not diffs            | The code has diverged; replaying a diff would break business logic.                      |
| Git tags are the source of truth           | A consumer doesn't have future-version files on disk; the tag does. (Disk = draft fallback.) |
| Tool-agnostic markdown + JSON              | Works for a human and for any agent (Claude, Cursor, …); no tool lock-in.                |
| Skills are thin shims                      | [`SKILL.md`](../../.claude/skills/upgrade-boilerplate/SKILL.md) holds no process — it points to the runbook. One source of truth. |
| Pure logic isolated from I/O               | `boilerplate-core.ts` (path computation, parsing) is side-effect-free and unit-tested; git/fs effects live in `boilerplate.ts`. |
| Safety-first git policy                    | Refuses a dirty worktree, dedicated branch, **never** auto push/merge/stash, one commit per intention, `breaking-manual` stops. |
| Removable in one move                      | `rm -rf .boilerstone` + drop the `boilerplate` script. Nothing else depends on it.       |

## What is real vs. what is a vision

- **Real and working**: the CLI (`status/doctor/path/prepare/init`), the state
  + schema, the tested pure path/parse logic, the consumer cleanup, the skill shim.
- **Only one real intention exists** (`v1.0.0/setup-boilerplate-tracking`). There
  is **no proven release-to-release migration yet** — this is **pilot** stage,
  not broad rollout.
- **No release tags are published yet**, so the disk fallback is what makes the
  CLI usable today. Don't remove it assuming it's dead.
- **The "module registry" roadmap** (importing optional modules, shadcn-style) is
  a design intent, **not implemented**.

## Where things live

```
.boilerstone/
  README.md                 # consumer-facing map (kept in consumers)
  boilerplate.json          # committed state (kept)
  boilerplate.schema.json   # state schema (kept)
  cli/
    boilerplate-core.ts     # pure logic: version compare, metadata parse, path compute  ← start here
    boilerplate.ts          # commands wired to git/fs
    boilerplate-core.spec.ts# tests (pure logic, archive, CLI smoke, prepare, cleanup)
  docs/
    upgrade-runbook.md       # THE workflow, identical for human/AI (kept)
    ai-upgrades-implementation.md  # this file (producer-only, removed in consumers)
    pilot-rollout.md         # internal pilot guide (producer-only)
  migration-intentions/      # published intentions, one dir per release (producer-only)
    TEMPLATE.md
    v1.0.0/
```
