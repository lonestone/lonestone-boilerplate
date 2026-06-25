# Architecture & design decisions

> Maintainer note (producer-only; removed from consumer projects). The *why* behind the system's structure. For the *what* — the philosophy and each command — read [how-it-works.md](./how-it-works.md); for the execution procedure, [upgrade-runbook.md](./upgrade-runbook.md).

## Design decisions

| Decision | Why |
| --- | --- |
| Ship intentions (meaning), not diffs | The consumer's code has diverged; replaying a diff would overwrite business logic. |
| Git tags are the source of truth for releases | A project forked at an old version doesn't have newer files on disk, but the tag does. Disk is a fallback for releases drafted but not yet tagged. |
| Tool-agnostic markdown + JSON | The same artifacts work for a human and for any agent (Claude, Cursor, …); no tool lock-in. |
| Skills are thin shims | [`SKILL.md`](../../.claude/skills/upgrade-boilerplate/SKILL.md) holds no process — it points at the runbook, so there is one source of truth. |
| Pure logic isolated from I/O | `boilerplate-core.ts` (path computation, metadata parsing, wiring helpers) is side-effect-free and unit-tested; git and filesystem effects live in `boilerplate.ts`. |
| Safety-first git policy | Refuses a dirty worktree, works on a dedicated branch, never auto-pushes/merges/stashes, one commit per intention, and `breaking-manual` intentions stop for a human. |
| Removable in one move | `rm -rf .boilerstone` plus dropping the `boilerplate` script detaches the system; nothing else depends on it. |

## Two classifications drive the plan

Intentions carry a `classification` in their frontmatter. `no-migration` and `informational` are dropped from the plan; `migration` is applied; `breaking-manual` stops for a human decision before any edit. **Domains** (`tooling`, `api`, `frontend`, `ci`, `docker-env`, …) let a project opt out of areas it doesn't use — intentions whose domain isn't in `trackedDomains` are filtered out automatically.

## Producer vs consumer (one directory, two modes)

In the boilerplate repo everything is present: published intentions, the CLI, tests, these maintainer docs. In a generated or onboarded project, the producer side is dropped — `cleanupBoilerplateFiles()` in [`cli/setup.ts`](../../cli/setup.ts) (for `pnpm rock`) and the `bootstrap` command (for existing projects) both remove `migration-intentions/`, the example state, and these internal docs, while keeping the local state, the CLI, the schema, and the consumer-facing docs. Future-release intentions are then read from git tags rather than from disk.

The list of producer-only paths is currently mirrored in three places — `PRODUCER_ARTIFACTS` in `boilerplate-core.ts`, `filesToRemove` in `cli/setup.ts`, and the doctor "consumer cleanup" check in `boilerplate.ts`. Keep them in sync, or consolidate them.

## What is real vs. what is vision

- **Real and working**: the CLI (`bootstrap`, `upgrade init/status/doctor/path/prepare`, `versions list`), the committed state + schema, the tested pure logic, the consumer switch, the curl installer, and the skill shim.
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
    utils.ts                 # vendored colorize / isolatedGitEnv (keeps the CLI self-contained)
    boilerplate-core.spec.ts # tests: pure logic, archive, CLI smoke, bootstrap, cleanup
  docs/
    how-it-works.md          # philosophy + each command (kept in consumers)
    upgrade-runbook.md       # the execution procedure (kept)
    ai-upgrades-implementation.md  # this file (producer-only)
    pilot-rollout.md         # pilot guide (producer-only)
  migration-intentions/      # published intentions, one dir per release (producer-only)
```
