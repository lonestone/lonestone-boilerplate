# `.boilerstone/` — Boilerplate upgrade system

Once a project is generated from this boilerplate, the code is yours and it diverges immediately. That means upstream improvements can never be merged back as plain diffs — a diff would land on top of code that has moved on and clobber your work.

So instead of diffs, each boilerplate release publishes **migration intentions**: short markdown files that say what changed, why, and how to tell whether it concerns your project. You (or an AI agent you supervise) read each intention and make the smallest equivalent change in your own code.

Everything the system needs lives in this directory, as markdown and JSON. It doesn't depend on any particular AI tool: the `.claude/skills/boilerstone-*` and `.cursor/skills/boilerstone-*` directories are thin entry points that just point back here. The workflow we actually run day to day is a developer piloting an agent — the agent reads the intentions and edits, the developer reviews every commit — but you can execute an upgrade entirely by hand with the same documents.

Where to start:

- **New here?** Read [docs/how-it-works.md](./docs/how-it-works.md). It explains why the system exists and walks through every command.
- **Running an upgrade?** Follow [docs/upgrade-runbook.md](./docs/upgrade-runbook.md).
- **Publishing a boilerplate release?** Follow [docs/release-maintainer-runbook.md](./docs/release-maintainer-runbook.md), not your memory. The `boilerstone-release` skill walks through that exact runbook.

## What's in here

```
boilerplate.json          # This project's state: source version, applied/skipped intentions
boilerplate.schema.json   # Schema for the state file
cli/                      # The upgrade CLI (and its tests, in the boilerplate repo)
docs/how-it-works.md      # Why the system exists + what each command does (start here)
docs/upgrade-runbook.md   # The upgrade procedure — same steps for humans and AI agents
docs/release-maintainer-runbook.md # How to publish a new release (boilerplate repo only)
migration-intentions/     # Published intentions, one directory per release (boilerplate repo only)
```

In the boilerplate repository this directory carries both sides: the producer side (published intentions, release tooling, CLI tests, maintainer docs) and the consumer side (tracking state and the upgrade CLI). 

When a new project runs `pnpm rock`, the setup script strips the producer side and keeps only what a consumer needs. From then on, published intentions come from the boilerplate's git tags, not from disk — so if you're in a generated project and don't see `migration-intentions/`, that's expected.

## Onboarding a project

[`install.sh`](../install.sh) at the repository root is the single entry point for the whole lifecycle. It only needs `git` and `pnpm` — no GitHub "Use this template", no third-party scaffolder. By default it resolves the latest published release tag and downloads that exact snapshot: a full clone for a new project, a sparse checkout of `.boilerstone/` alone for onboarding.

```bash
# Create a new project from scratch
curl -fsSL https://raw.githubusercontent.com/lonestone/lonestone-boilerplate/main/install.sh | sh -s -- init my-app

# Onboard an existing project (run at its root)
curl -fsSL https://raw.githubusercontent.com/lonestone/lonestone-boilerplate/main/install.sh | sh -s -- onboard

# Prepare an upgrade in a wired project (defaults to the latest release)
curl -fsSL https://raw.githubusercontent.com/lonestone/lonestone-boilerplate/main/install.sh | sh -s -- upgrade
curl -fsSL https://raw.githubusercontent.com/lonestone/lonestone-boilerplate/main/install.sh | sh -s -- upgrade 1.6.0
```

`--ref latest` is the default; pin a release with `--ref vX.Y.Z`. Branch refs like `main` are deliberately rejected, so a project never starts from unreleased code. To use a fork or private mirror, set `BOILERPLATE_REPO=<url>` — that repository must publish the same kind of `vX.Y.Z` tags.

What each command does:

- **`init`** clones the template and runs `pnpm rock`, the normal first-run setup.
- **`onboard`** fetches `.boilerstone/` and the `boilerstone-upgrade` skills into an existing project, runs `bootstrap` (below), then offers to commit the result (`[Y/n]`, default yes).
- **`upgrade [version]`** runs `pnpm boilerplate upgrade --to <version|latest>`. It fetches the release, computes which intentions apply, and lets you pick among them interactively (without a terminal, everything is staged). Then it creates a branch named `upgrade/v<current>-to-v<target>` and publishes `.boilerstone/upgrade/` with the numbered intentions and reference files. It refuses to overwrite an existing workspace, and it never edits your app code, commits, or pushes — applying the staged intentions is a separate, reviewable step (the [runbook](./docs/upgrade-runbook.md)).

`bootstrap` wires up the project: it adds the `boilerplate` script and a `tsx` devDependency to the root `package.json`, gitignores `.boilerstone/upgrade/`, switches `.boilerstone/` to consumer mode, and initializes the tracking state. It's idempotent and never overwrites what's already there. One thing it deliberately does **not** do is run `pnpm rock` — that script renames packages and rewrites env/docker files, which is fine on a fresh template and destructive on a real project.

> **Heads-up on v1.0.0:** its intentions are baseline catch-ups ("align with the v1.0.0 …"), much broader than the narrow deltas later releases ship. When onboarding an older project, budget roughly one working session per intention.

If you'd rather not pipe a script from the internet, `onboard` boils down to two steps you can run yourself:

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
pnpm boilerplate upgrade status --json            # Where am I, and am I ready? (--json for agents/scripts)
pnpm boilerplate intentions lint                  # Validate intention metadata before release
pnpm boilerplate upgrade                          # Stage the next upgrade (latest, auto-fetch, choose intentions)
pnpm boilerplate upgrade path --to 1.6.0 --json   # What's between me and the target?
pnpm boilerplate upgrade record --id <id> --applied
pnpm boilerplate upgrade finish --to 1.6.0
```

- **Human executor**: follow [docs/upgrade-runbook.md](./docs/upgrade-runbook.md).
- **AI executor**: the Claude Code and Cursor `boilerstone-upgrade` skills follow the same runbook.

If you want to know how the CLI is structured internally (path resolution, tracking-state lifecycle), that's covered in `docs/ai-upgrades-implementation.md` in the boilerplate repository. Tests live in `cli/*.spec.ts` and run with the regular `pnpm test`.

## Maintainer release checklist

Before tagging a boilerplate release, follow [docs/release-maintainer-runbook.md](./docs/release-maintainer-runbook.md). The short version:

1. Pick the version and create `.boilerstone/migration-intentions/vX.Y.Z/`
2. Inventory `git diff --name-status vPREVIOUS..HEAD`
3. Classify every meaningful change in its intention's frontmatter (`no-migration`, `informational`, `migration`, `breaking-manual`); release-level no-migration prose goes in the release README intro
4. Write one intention per actionable adaptation, named `NN-slug.md` in execution order, with `requires:` for dependencies
5. Update `CHANGELOG.md` and `.boilerstone/boilerplate.example.json`
6. Run `pnpm boilerplate intentions sync` to regenerate the release README's intentions block
7. Run `pnpm fmt:check`, `pnpm typecheck`, `pnpm test`, and `pnpm --filter @boilerstone/boilerplate lint:intentions`
8. Run `pnpm boilerplate upgrade path --from <previous-version> --to <next-version> --json`
9. Smoke test install/onboard in a temporary consumer
10. Create and push the `vX.Y.Z` git tag after merge to `main`

## Detaching from the boilerplate

Leaving is cheap by design. If your project no longer wants boilerplate upgrades:

1. `rm -rf .boilerstone`
2. Remove the `boilerplate` script from the root `package.json`
3. Optionally remove the `.boilerstone` entry in `pnpm-workspace.yaml` and the `.boilerstone/upgrade/` line in `.gitignore` (both are harmless if left)
4. Optionally remove `.claude/skills/boilerstone-upgrade/`
5. Optionally remove `.cursor/skills/boilerstone-upgrade/`

Nothing else in the repository depends on this directory.

## Roadmap

Longer term we'd like this directory to also act as a module registry, shadcn-style: import an optional boilerplate module (storage, AI, …) into an existing project on demand, with the same philosophy — declared knowledge, local execution, easy removal. Not built yet; the upgrade system is the first brick.
