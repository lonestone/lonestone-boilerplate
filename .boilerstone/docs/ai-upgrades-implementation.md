# Architecture & design decisions

> Maintainer note (producer-only; removed from consumer projects). The _why_ behind the system's structure. For the _what_ — the philosophy and each command — read [how-it-works.md](./how-it-works.md); for the execution procedure, [upgrade-runbook.md](./upgrade-runbook.md).

## Design decisions

| Decision                                      | Why                                                                                                                                                                                                                                         |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ship intentions (meaning), not diffs          | The consumer's code has diverged; replaying a diff would overwrite business logic.                                                                                                                                                          |
| Git tags are the source of truth for releases | A project forked at an old version doesn't have newer files on disk, but the tag does. Disk is a fallback for releases drafted but not yet tagged.                                                                                          |
| Tool-agnostic markdown + JSON                 | The same artifacts work for a human and for any agent (Claude, Cursor, …); no tool lock-in.                                                                                                                                                 |
| Skills are thin shims                         | [`SKILL.md`](../../.claude/skills/boilerstone-upgrade/SKILL.md) holds no process — it points at the runbook, so there is one source of truth.                                                                                               |
| Pure logic isolated from I/O                  | `computeUpgradePath` remains side-effect-free in `boilerplate-core.ts`; the deeper `resolveUpgradePath` module in `boilerplate.ts` owns state, publication, target, provenance, and intention discovery behind one interface.               |
| Safety-first git policy                       | Refuses a dirty worktree, works on a dedicated branch, never auto-pushes/merges/stashes, recommends one commit per risky intention while allowing small supervised batches, and `breaking-manual` intentions stop for a human.              |
| Removable in one move                         | `rm -rf .boilerstone` plus dropping the `boilerplate` script detaches the system; nothing else depends on it.                                                                                                                               |
| Executor-independent protocol                 | Numbered intentions, git provenance, `copy`/`adapt` policy, tracking state, and session progress live in markdown/JSON produced by the CLI. Human execution and AI skills are adapters over the same protocol.                              |
| Atomic preparation                            | `prepareUpgrade` completes local preflight before resolution, builds in a temporary directory, validates the target, then creates the branch and publishes the workspace. Failures leave no partial workspace and never overwrite progress. |
| Deep tracking-state lifecycle                 | `trackingState` owns creation, reading, parsing, canonical ID normalization, schema-aligned validation, outcome recording, downgrade-safe finalization, and atomic persistence; commands retain presentation and orchestration.             |

## Upgrade resolution module

`resolveUpgradePath` is the single interface used by `upgrade path`, `prepareUpgrade`, and `upgrade finish`. Its input is the project path, an optional source override, a target version (or `latest`), and one publication-access policy:

- `local-only` never fetches;
- `refresh-if-needed` refreshes for `latest` or when no local publication exists, then can continue from local publications with a warning if the refresh fails;
- `refresh-required` always refreshes and propagates a fetch failure.

The result contains the computed path, branch name, tracked state when present, target publication, source/target git references with provenance, and warnings. The module never changes the branch, workspace, or tracking state. Publication discovery is therefore one deep implementation rather than three shallow reconstructions: callers choose policy and consume the result, while target validation, `0.0.0`, tracked domains, applied/skipped intentions, and app-tag exclusion retain locality at this seam.

## Tracking-state lifecycle module

`trackingState` in `cli/tracking-state.ts` is the consumer CLI's single interface for `.boilerstone/boilerplate.json`. Its implementation owns creation, filesystem reading and writing, JSON parsing, canonical version and intention-ID normalization, runtime validation, intention outcomes, and final version changes. Writes use a temporary file in the state directory followed by atomic rename and cleanup. `upgrade init` and `bootstrap` create state through this interface; `record` and `finish` return new validated states instead of mutating parsed JSON directly. The command module keeps CLI output and best-effort session-checklist synchronization outside the interface.

Runtime validation mirrors `boilerplate.schema.json`: schema version 1, source fields and patterns, known unique domains, intention object shape, valid dates, minimum skip-reason length, and unique non-contradictory intention ids. The schema remains the declared contract; the implementation adds calendar-date validation and canonical persistence without adding a JSON Schema dependency.

Producer drafts never mix working-tree intentions with committed references. Resolution requires a clean producer checkout and a release folder committed in `HEAD`, then reads both intention content and reference projections from that same `HEAD` before any consumer branch or workspace is published.

The root `cli/setup.ts` deliberately duplicates creation defaults because it must remain importable after `.boilerstone/` is removed. It never imports this module. A synchronization test compares the state produced by setup with the consumer interface, preserving removability while making the duplicated point of variation explicit.

## Two classifications drive the plan

Intentions carry a `classification` in their frontmatter. `no-migration` and `informational` are dropped from the plan; `migration` is applied; `breaking-manual` stops for a human decision before any edit. **Domains** (`tooling`, `api`, `frontend`, `ci`, `docker-env`, …) let a project opt out of areas it doesn't use — intentions whose domain isn't in `trackedDomains` are filtered out automatically.

## Producer vs consumer (one directory, two modes)

In the boilerplate repo everything is present: published intentions, the CLI, tests, these maintainer docs. In a generated or onboarded project, the producer side is dropped — `cleanupBoilerplateFiles()` in [`cli/setup.ts`](../../cli/setup.ts) (for `pnpm rock`) and the `bootstrap` command (for existing projects) both remove `migration-intentions/`, the example state, CLI Vitest suite/config, the release-maintainer runbook, and these internal docs, while keeping the local state, the CLI runtime, the schema, and the consumer-facing docs. Future-release intentions are then read from git tags rather than from disk.

The list of producer-only paths has one source of truth, `PRODUCER_ARTIFACTS` in `boilerplate-core.ts`: the status "consumer cleanup" readiness check derives from it, and `PRODUCER_FILES_TO_REMOVE` in `cli/setup.ts` mirrors its `.boilerstone/` subset (a spec test enforces the sync — setup cannot import from `.boilerstone/`, which must stay removable in one move).

## What is real vs. what is vision

- **Real and working**: the CLI (`bootstrap`, `upgrade init/status/path/prepare`, `versions list`), the committed state + schema, the tested pure logic, the consumer switch, the curl installer, and the skill shim.
- **Pilot stage**: only one intention exists (`v1.0.0/setup-boilerplate-tracking`). No release-to-release migration has been proven yet.
- **No release tags are published yet**, so the disk fallback is what makes the CLI usable today — don't remove it assuming it's dead.
- **The "module registry"** (importing optional modules on demand, shadcn-style) is a design intent, not implemented.

## Where things live

```
.boilerstone/
  README.md                  # quick map + onboarding (kept in consumers)
  boilerplate.json           # committed state (kept)
  boilerplate.schema.json    # state schema (kept)
  cli/
    boilerplate-core.ts      # pure logic: version compare, metadata parse, path compute, wiring  ← start here
    boilerplate.ts           # commands wired to git/fs
    tracking-state.ts        # deep consumer tracking-state lifecycle interface
    utils.ts                 # vendored colorize / isolatedGitEnv (keeps the CLI self-contained)
    boilerplate-core.spec.ts # tests: pure logic, archive, CLI smoke, bootstrap, cleanup
    tracking-state.spec.ts   # direct interface tests for state validation and lifecycle
  docs/
    how-it-works.md          # philosophy + each command (kept in consumers)
    upgrade-runbook.md       # the execution procedure (kept)
    ai-upgrades-implementation.md  # this file (producer-only)
    pilot-rollout.md         # pilot guide (producer-only)
  migration-intentions/      # published intentions, one dir per release (producer-only)
```
