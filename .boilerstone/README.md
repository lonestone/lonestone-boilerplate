# `.boilerstone/` — Upgrade system

This directory is the tool-agnostic home of the boilerplate upgrade system. A project created from this template diverges forever, so upstream changes cannot be merged as code. Instead, each release publishes **migration intentions** — the *meaning* of a change (goal, why, applicability, stop conditions) — and an executor (a human developer or an AI agent) replays that meaning in the consumer project as the smallest safe equivalent change.

Everything an executor needs lives here, in markdown and JSON, independent of which AI tool (if any) the team uses. Tool-specific entry points (e.g. `.claude/skills/upgrade-boilerplate/`) are thin shims pointing at this directory.

## Contents

In the boilerplate repository, this directory contains both producer-side artifacts (published intentions, release helpers, tests) and consumer-side artifacts (local project state and upgrade runner):

```
boilerplate.json          # This project's state: source version, applied/skipped intentions
boilerplate.schema.json   # Schema for the state file
cli/                      # CLI: status, path, prepare (pure logic in boilerplate-core.ts, tested)
docs/upgrade-runbook.md   # THE workflow — same steps for humans and AI agents
docs/                     # Implementation notes, pilot guide
migration-intentions/     # Published intentions, one directory per release
legacy-checkpoints/       # Consolidated jumps for very old projects
```

When a new project runs `pnpm rock`, the setup script switches `.boilerstone/` to consumer mode: it keeps local tracking and the upgrade CLI, but removes producer-only artifacts such as `migration-intentions/`, `legacy-checkpoints/`, and internal rollout docs. Published intentions are resolved from the boilerplate repository and git tags when an upgrade is prepared.

## Usage

```bash
pnpm boilerplate                                  # Help
pnpm boilerplate upgrade status --json            # Where am I? (--json for agents/scripts)
pnpm boilerplate upgrade doctor --json            # Is the project ready to upgrade?
pnpm boilerplate upgrade path --to 1.6.0 --json   # What's between me and the target?
pnpm boilerplate upgrade prepare --to 1.6.0       # Build the upgrade workspace
```

- **Human executor**: follow [docs/upgrade-runbook.md](./docs/upgrade-runbook.md).
- **AI executor**: the Claude Code skill `upgrade-boilerplate` follows the same runbook. Cursor loads skills from `.claude/skills/` too.

Tests for the CLI live in `cli/*.spec.ts` and run with the regular workspace test suite (`pnpm test`).

## Maintainer release checklist

Before tagging a boilerplate release:

1. Classify each meaningful change as `no-migration`, `informational`, `migration`, or `breaking-manual`
2. Write or update migration intentions for actionable changes
3. Update `.boilerstone/boilerplate.example.json` to the new source version
4. Run `pnpm boilerplate upgrade path --from <previous-version> --to <next-version> --json`
5. Run `pnpm --filter @boilerstone/boilerplate test`
6. Create and push the `vX.Y.Z` git tag so consumer projects can fetch the release intentions

## Detaching from the boilerplate

This system is designed to be removable in one move. If your project no longer wants boilerplate upgrades:

1. `rm -rf .boilerstone`
2. Remove the `boilerplate` script from the root `package.json`
3. Optionally remove the `.boilerstone` entry in `pnpm-workspace.yaml` and the `.boilerstone/upgrade/` line in `.gitignore` (both are harmless if left)
4. Optionally remove `.claude/skills/upgrade-boilerplate/`

Nothing else in the repository depends on this directory.

## Roadmap

The longer-term intent is for this directory to also act as a **module registry** (à la shadcn): importing optional boilerplate modules (a storage module, an AI module, ...) into an existing project on demand, with the same philosophy — declared knowledge, local execution, easy removal. Not built yet; the upgrade system above is the first brick.
