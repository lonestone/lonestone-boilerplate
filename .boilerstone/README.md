# `.boilerstone/` — Upgrade system

This directory is the tool-agnostic home of the boilerplate upgrade system. A project created from this template diverges forever, so upstream changes cannot be merged as code. Instead, each release publishes **migration intentions** — the *meaning* of a change (goal, why, applicability, stop conditions) — and an executor (a human developer or an AI agent) replays that meaning in the consumer project as the smallest safe equivalent change.

Everything an executor needs lives here, in markdown and JSON, independent of which AI tool (if any) the team uses. Tool-specific entry points (e.g. `.claude/skills/upgrade-boilerplate/`, `.cursor/skills/upgrade-boilerplate/`) are thin shims pointing at this directory.

The nominal workflow is human-in-the-loop: a developer pilots an agentic AI, and the agent uses the CLI, git, tests, and the migration intention files as tools. The system is optimized for that supervised agent flow, while staying readable enough for a human to execute manually when needed.

**New here?** Read [docs/how-it-works.md](./docs/how-it-works.md) — the philosophy and every command, in plain terms.

**Publishing a new boilerplate version?** Follow [docs/release-maintainer-runbook.md](./docs/release-maintainer-runbook.md). Do not rely on memory or a vague release summary.

## Contents

In the boilerplate repository, this directory contains both producer-side artifacts (published intentions, release helpers, tests) and consumer-side artifacts (local project state and upgrade runner):

```
boilerplate.json          # This project's state: source version/commit, applied/skipped intentions
boilerplate.schema.json   # Schema for the state file
cli/                      # CLI: status, path, prepare (pure logic in boilerplate-core.ts, tested)
docs/how-it-works.md      # Philosophy + each command, in plain terms (start here)
docs/upgrade-runbook.md   # The execution procedure — same steps for humans and AI agents
docs/release-maintainer-runbook.md # Maintainer procedure for creating a new release
migration-intentions/     # Published intentions, one directory per release
```

When a new project runs `pnpm rock`, the setup script switches `.boilerstone/` to consumer mode: it keeps local tracking and the upgrade CLI, but removes producer-only artifacts such as `migration-intentions/` and internal rollout docs. Published intentions are resolved from the boilerplate repository and git tags when an upgrade is prepared.

## Onboarding a project

The installer at the repository root ([`install.sh`](../install.sh)) is the single entry point for the whole lifecycle. It needs only `git` and `pnpm` — no GitHub "Use this template", no third-party scaffolder. It downloads a repository snapshot with `git` (full clone for a new project, sparse-checkout for `.boilerstone/` alone).

```bash
# Create a new project from scratch
curl -fsSL https://raw.githubusercontent.com/lonestone/lonestone-boilerplate/main/install.sh | sh -s -- init my-app

# Onboard an existing project (run at its root)
curl -fsSL https://raw.githubusercontent.com/lonestone/lonestone-boilerplate/main/install.sh | sh -s -- onboard

# Prepare an upgrade in a wired project (defaults to the latest release)
curl -fsSL https://raw.githubusercontent.com/lonestone/lonestone-boilerplate/main/install.sh | sh -s -- upgrade
curl -fsSL https://raw.githubusercontent.com/lonestone/lonestone-boilerplate/main/install.sh | sh -s -- upgrade 1.6.0
```

Pin a release with `--ref <tag>`; point at a fork/private repo with `BOILERPLATE_REPO=<url>`.

- **`init`** clones the template and runs `pnpm rock` (the normal first-run setup).
- **`onboard`** fetches `.boilerstone/` and runs `bootstrap` (below).
- **`upgrade [version]`** runs `pnpm boilerplate upgrade prepare --to <version|latest> --fetch`. It fetches the release tags, **creates a branch** `upgrade/v<current>-to-v<target>`, and stages a gitignored `.boilerstone/upgrade/` workspace (intentions + reference trees + session prompt). It does **not** touch your app code, commit, or push — applying the staged intentions is a separate, reviewable step (see the runbook).

`bootstrap` wires the root `package.json` (adds the `boilerplate` script and a `tsx` devDependency), ignores `.boilerstone/upgrade/`, switches `.boilerstone/` to consumer mode, and initializes tracking. It is idempotent and never overwrites existing entries. It does **not** run `pnpm rock` (which renames packages and rewrites env/docker — safe only on a fresh template, destructive on an existing project).

Without the installer, the same two steps run by `onboard` are:

```bash
git clone --depth 1 --filter=blob:none --sparse <repo> _bp && git -C _bp sparse-checkout set .boilerstone
mv _bp/.boilerstone .boilerstone && rm -rf _bp
rm -f .boilerstone/boilerplate.json   # drop the repo's own tracking state so init detects yours
pnpm dlx tsx .boilerstone/cli/boilerplate.ts bootstrap && pnpm install
```

## Usage

```bash
pnpm boilerplate                                  # Help
pnpm boilerplate bootstrap                         # Onboard an existing project (see above)
pnpm boilerplate upgrade status --json            # Where am I? (--json for agents/scripts)
pnpm boilerplate intentions lint                  # Validate intention metadata before release
pnpm boilerplate upgrade doctor --json            # Is the project ready to upgrade?
pnpm boilerplate upgrade path --to 1.6.0 --json   # What's between me and the target?
pnpm boilerplate upgrade prepare --to 1.6.0       # Build the upgrade workspace
pnpm boilerplate upgrade record --id <id> --applied
pnpm boilerplate upgrade finish --to 1.6.0
```

- **Human executor**: follow [docs/upgrade-runbook.md](./docs/upgrade-runbook.md).
- **AI executor**: the Claude Code skill and Cursor skill `upgrade-boilerplate` follow the same runbook.

Tests for the CLI live in `cli/*.spec.ts` and run with the regular workspace test suite (`pnpm test`).

## Maintainer release checklist

Before tagging a boilerplate release, follow [docs/release-maintainer-runbook.md](./docs/release-maintainer-runbook.md). Short version:

1. Pick the version and create `.boilerstone/migration-intentions/vX.Y.Z/`
2. Inventory `git diff --name-status vPREVIOUS..HEAD`
3. Classify every meaningful change in `classification.md`
4. Write one intention per actionable adaptation
5. Update `CHANGELOG.md` and `.boilerstone/boilerplate.example.json`
6. Run `pnpm fmt:check`, `pnpm typecheck`, `pnpm test`, and `pnpm --filter @boilerstone/boilerplate lint:intentions`
7. Run `pnpm boilerplate upgrade path --from <previous-version> --to <next-version> --json`
8. Smoke test install/onboard in a temporary consumer
9. Create and push the `vX.Y.Z` git tag after merge to `main`

## Detaching from the boilerplate

This system is designed to be removable in one move. If your project no longer wants boilerplate upgrades:

1. `rm -rf .boilerstone`
2. Remove the `boilerplate` script from the root `package.json`
3. Optionally remove the `.boilerstone` entry in `pnpm-workspace.yaml` and the `.boilerstone/upgrade/` line in `.gitignore` (both are harmless if left)
4. Optionally remove `.claude/skills/upgrade-boilerplate/`
5. Optionally remove `.cursor/skills/upgrade-boilerplate/`

Nothing else in the repository depends on this directory.

## Roadmap

The longer-term intent is for this directory to also act as a **module registry** (à la shadcn): importing optional boilerplate modules (a storage module, an AI module, ...) into an existing project on demand, with the same philosophy — declared knowledge, local execution, easy removal. Not built yet; the upgrade system above is the first brick.
