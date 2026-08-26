# Architecture & design decisions

> Maintainer note (producer-only; removed from consumer projects). This page records *why* the system is built the way it is, so future changes don't accidentally undo a deliberate choice. For what the system does, read [how-it-works.md](./how-it-works.md); for the execution procedure, [upgrade-runbook.md](./upgrade-runbook.md).

## Design decisions

| Decision | Why |
| --- | --- |
| Ship intentions (meaning), not diffs | The consumer's code has diverged; replaying a diff would overwrite business logic. |
| Git tags are the source of truth for releases | A project forked at an old version doesn't have newer files on disk, but the tag does. Disk is only a fallback for drafts not yet tagged. |
| Tool-agnostic markdown + JSON | The same artifacts work for a human and for any agent. No tool lock-in. |
| Skills are thin shims | [`SKILL.md`](../../.claude/skills/boilerstone-upgrade/SKILL.md) holds no process of its own — it points at the runbook, so the process has one home. |
| Pure logic isolated from I/O | `computeUpgradePath` in `boilerplate-core.ts` is side-effect-free and easy to test; `resolveUpgradePath` in `boilerplate.ts` owns everything stateful behind one interface. |
| Safety-first git policy | Refuse a dirty worktree, work on a dedicated branch, never auto-push/merge/stash, one commit per risky intention (small supervised batches allowed), and `breaking-manual` always stops for a human. |
| Removable in one move | `rm -rf .boilerstone` plus dropping the `boilerplate` script detaches the system. Nothing else depends on it — keep it that way. |
| Executor-independent protocol | Intentions, provenance, `copy`/`adapt` policy, tracking state, and session progress are all markdown/JSON produced by the CLI. Humans and AI skills are just adapters over that protocol. |
| Atomic preparation | `prepareUpgrade` builds and validates in a temporary directory before creating the branch or publishing the workspace. A failure leaves no partial workspace and never overwrites progress. |
| Deep tracking-state lifecycle | Everything about `boilerplate.json` — creation, validation, recording, finalization, persistence — lives behind the `trackingState` interface; commands only present its results. |

## Upgrade resolution

`upgrade path`, `prepare`, and `finish` all need to answer the same question: which publications and intentions sit between this project and that target? Rather than three slightly different reimplementations, they share one module, `resolveUpgradePath`. Its input is the project path, an optional source override, a target version (or `latest`), and a publication-access policy that encodes how each caller is allowed to hit the network:

- `local-only` never fetches (used by `finish`, which must fail closed);
- `refresh-if-needed` fetches for `latest` or when nothing is local, and tolerates a failed refresh if a local publication exists (the default `upgrade` behavior);
- `refresh-required` always fetches and propagates any failure (`--fetch`).

The result carries the computed path, branch name, tracked state when present, target publication, source/target git references with provenance, and warnings. The module only computes — it never touches the branch, workspace, or tracking state. Caller-specific concerns (target validation, the `0.0.0` case, tracked domains, applied/skipped filtering, app-tag exclusion) stay local to this seam.

## Tracking-state lifecycle

`trackingState` in `cli/tracking-state.ts` is the only way the consumer CLI touches `.boilerstone/boilerplate.json`. It owns creation, reading and writing, parsing, canonical version and intention-ID normalization, runtime validation, intention outcomes, and the final version change. Writes go through a temporary file in the state directory followed by an atomic rename. `upgrade init` and `bootstrap` create state through this interface; `record` and `finish` return new validated states instead of mutating parsed JSON in place. CLI output and the best-effort session-checklist sync stay in the command module, outside the interface.

Runtime validation mirrors `boilerplate.schema.json`: schema version 1, source fields and patterns, known unique domains, intention object shape, valid dates, minimum skip-reason length, unique non-contradictory intention ids. The schema stays the declared contract; the implementation adds calendar-date checks and canonical persistence without pulling in a JSON Schema dependency.

Producer drafts never mix working-tree intentions with committed references: resolution requires a clean producer checkout and a release folder committed in `HEAD`, then reads both intention content and reference projections from that same `HEAD`.

One deliberate duplication to be aware of: the root `cli/setup.ts` re-declares the state-creation defaults instead of importing this module. That's because setup must keep working after `.boilerstone/` is deleted — removability wins over DRY here. A synchronization test compares both sides so the duplication can't silently drift.

## Two classifications drive the plan

Intentions carry a `classification` in their frontmatter. `no-migration` and `informational` are dropped from the plan; `migration` is applied; `breaking-manual` stops for a human decision before any edit. **Domains** (`tooling`, `api`, `frontend`, `ci`, `docker-env`, …) let a project opt out of areas it doesn't use — intentions whose domain isn't in `trackedDomains` are filtered out automatically.

## Producer vs consumer (one directory, two modes)

In the boilerplate repo everything is present: published intentions, the CLI, tests, these maintainer docs. In a generated or onboarded project, the producer side is dropped. `cleanupBoilerplateFiles()` in [`cli/setup.ts`](../../cli/setup.ts) (for `pnpm rock`) and the `bootstrap` command (for existing projects) both remove `migration-intentions/`, the example state, the CLI test suite and Vitest config, the release-maintainer runbook, and these internal docs — and keep the local state, the CLI runtime, the schema, and the consumer-facing docs. Future-release intentions are then read from git tags rather than from disk.

The list of producer-only paths has one home, `PRODUCER_ARTIFACTS` in `boilerplate-core.ts`. The "consumer cleanup" readiness check in `status` derives from it, and `PRODUCER_FILES_TO_REMOVE` in `cli/setup.ts` mirrors its `.boilerstone/` subset — mirrors, not imports, because setup can't depend on a directory that must stay removable. A spec test enforces that the two lists stay in sync.

## Where the system actually stands

Be honest with yourself about this when extending the system:

- **Real and working**: the CLI (`bootstrap`, `upgrade init/status/path/prepare/record/finish`, `versions list`, `intentions lint/sync`), the committed state and schema, the curl installer, the consumer switch, and the skill shims. `v1.0.0` is tagged and published with its eight baseline intentions. Changelog generation moved to release-please; the old `changelog check` / `changelog release` commands are gone.
- **Not proven yet**: no release-to-release upgrade (v1.0.0 → v1.x) has been executed against a real diverged project. Treat the first one as a pilot — see [pilot-rollout.md](./pilot-rollout.md).
- **The disk fallback for untagged releases** is how maintainers test drafts before tagging. It looks like dead code if you only think about consumers; it isn't.
- **The module registry** (importing optional modules on demand, shadcn-style) is a design intent, not implemented.

## Where things live

```
.boilerstone/
  README.md                  # quick map + onboarding (kept in consumers)
  boilerplate.json           # committed state (kept)
  boilerplate.schema.json    # state schema (kept)
  cli/
    boilerplate-core.ts      # pure logic: version compare, metadata parse, path compute  ← start here
    boilerplate.ts           # commands wired to git/fs
    tracking-state.ts        # the tracking-state lifecycle interface
    utils.ts                 # vendored colorize / isolatedGitEnv (keeps the CLI self-contained)
    *.spec.ts                # tests: pure logic, CLI smoke, bootstrap, cleanup, install, state lifecycle
  docs/
    how-it-works.md          # philosophy + each command (kept in consumers)
    upgrade-runbook.md       # the execution procedure (kept)
    release-maintainer-runbook.md  # release procedure (producer-only)
    ai-upgrades-implementation.md  # this file (producer-only)
    pilot-rollout.md         # pilot guide (producer-only)
  migration-intentions/      # published intentions, one dir per release (producer-only)
```
