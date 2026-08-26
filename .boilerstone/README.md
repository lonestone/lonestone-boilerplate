# `.boilerstone/` — Boilerplate upgrade system

Once a project is generated from this boilerplate, the code is yours and it diverges immediately. Upstream improvements can't be merged as plain diffs — they'd land on top of code that has moved on.

So each release publishes **migration intentions**: short markdown files that say what changed, why, and how to tell whether it concerns your project. You (or an AI agent you supervise) replay the smallest equivalent change in your own code.

Everything lives here as markdown and JSON. Tool-specific skills (Claude Code, Cursor) are thin entry points that point back here. Same documents whether a human or an agent executes the upgrade.

## Where to start

- **New here?** [docs/how-it-works.md](./docs/how-it-works.md) — why the system exists and what each command does.
- **Running an upgrade?** [docs/upgrade-runbook.md](./docs/upgrade-runbook.md).
- **Publishing a release?** [docs/release-maintainer-runbook.md](./docs/release-maintainer-runbook.md) (boilerplate maintainers only).

## Getting started

[`install.sh`](../install.sh) is the entry point — needs only `git` and `pnpm`:

```bash
# New project
curl -fsSL https://raw.githubusercontent.com/lonestone/lonestone-boilerplate/main/install.sh | sh -s -- init my-app

# Existing project
curl -fsSL https://raw.githubusercontent.com/lonestone/lonestone-boilerplate/main/install.sh | sh -s -- onboard

# Stage an upgrade (does not edit app code)
curl -fsSL https://raw.githubusercontent.com/lonestone/lonestone-boilerplate/main/install.sh | sh -s -- upgrade
```

Pinning a version, forks, what `bootstrap` does, and the v1.0.0 catch-up caveat: [how-it-works.md](./docs/how-it-works.md#onboarding).

Once wired:

```bash
pnpm boilerplate upgrade status
pnpm boilerplate upgrade              # stage latest
# … apply intentions per the runbook …
pnpm boilerplate upgrade finish --to <version>
```

## What's in here

```
boilerplate.json          # Project state (version + applied/skipped intentions)
cli/                      # Upgrade CLI
docs/                     # How it works, upgrade runbook, release runbook
migration-intentions/     # Published intentions + unreleased/ staging (boilerplate repo only)
```

In a generated project, the producer side (`migration-intentions/`, release runbook, …) is stripped — intentions then come from git tags. That's expected.

## Detaching

1. `rm -rf .boilerstone`
2. Remove the `boilerplate` script from the root `package.json`
3. Optionally remove the skill shims and the `.boilerstone` workspace / gitignore entries

Nothing else in the repository depends on this directory.

## Roadmap

Eventually a module registry (shadcn-style optional imports). Not built yet — the upgrade system is the first brick.
