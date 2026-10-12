# `.boilerstone/` — Boilerplate upgrade system

Once a project is generated from this boilerplate, the code is yours and it diverges immediately. Upstream improvements can't be merged as plain diffs — they'd land on top of code that has moved on.

So each release publishes **migration intentions**: short markdown files that say what changed, why, and how to tell whether it concerns your project. You (or an AI agent you supervise) replay the smallest equivalent change in your own code.

Everything lives here as markdown and JSON. Tool-specific skills (Claude Code, Cursor) are thin entry points that point back here. Same documents whether a human or an agent executes the upgrade.

## Where to start

- **New here?** [docs/how-it-works.md](./docs/how-it-works.md) — why the system exists and what each command does.
- **Running an upgrade?** [docs/upgrade-runbook.md](./docs/upgrade-runbook.md).
- **Publishing a release?** [docs/release-maintainer-runbook.md](./docs/release-maintainer-runbook.md) (boilerplate maintainers only).

## Getting started

`@lonestone/boilerstone-cli` is the entry point — needs `git` and `pnpm`:

```bash
# New project
pnpm dlx @lonestone/boilerstone-cli init my-app

# Existing project
pnpm dlx @lonestone/boilerstone-cli onboard

# Stage an upgrade (does not edit app code)
pnpm dlx @lonestone/boilerstone-cli upgrade
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
docs/                     # How it works, upgrade runbook, release runbook
migration-intentions/     # Published intentions + unreleased/ staging (boilerplate repo only)
cli/                      # Published as @lonestone/boilerstone-cli (boilerplate repo only)
```

Generated projects call the published `@lonestone/boilerstone-cli` with `pnpm dlx` from two scripts: `pnpm boilerplate` (latest CLI) and `pnpm rock` (pinned to the project's release). They neither install it nor keep a copy of `cli/`.

In a generated project, the producer side (`cli/`, `migration-intentions/`, release runbook, …) is stripped — intentions then come from git tags. That's expected.

## Producer or consumer

The boilerplate repository is the **producer**: it writes and publishes migration intentions. A project generated from it, or onboarded to it, is a **consumer**: it only applies them.

One test tells them apart: **`.boilerstone/migration-intentions/` exists**. Only the producer has it. `init` and `bootstrap` remove it, so a consumer never does. This is the only definition. Skills, workflows and docs point here instead of restating it.

How the rest of the repository follows it:

- **Whole files** that only make sense in the producer are listed in `PRODUCER_FILES_TO_REMOVE` (`cli/src/generate.ts`), and `init` does not generate them. Today that includes the two intention workflows and the `boilerstone-intention` and `boilerstone-release` skills.
- **Parts of a shared file** (a step in `ci.yml`, a section of `scripts/github-repo-settings.md`, a step in the `finalize-pr` skill) sit between a `boilerstone:producer-only:begin` line and a `boilerstone:producer-only:end` line, in whatever comment syntax the file uses. `init` removes those lines from `.github/`, `scripts/`, `.claude/` and `.cursor/`, and fails on an unbalanced pair. `upgrade prepare` removes them from the reference files it stages from a release tag, so an upgrade never hands them to a project either. The producer keeps them. Do not fork a file for the producer.
- **Workflows** that reach a project despite the removal list (the list drifted, or someone copied them in) check the directory themselves and skip successfully when it is missing. A copy made before that check existed has no guard: a migration intention removes it.
- **Skills** that only apply to one side say so and point to this section.

`bootstrap` and `onboard` never touch anything outside `.boilerstone/`, so an existing project is cleaned up by a migration intention instead.

## Detaching

1. `rm -rf .boilerstone`
2. Remove the `boilerplate` script from the root `package.json`. Keep `rock` if you still use it for local setup: it runs through `pnpm dlx` and needs nothing else
3. Optionally remove the skill shims and any leftover `.boilerstone` / `.boilerstone/cli` workspace or gitignore entries

Nothing else in the repository depends on this directory.

## Roadmap

Eventually a module registry (shadcn-style optional imports). Not built yet — the upgrade system is the first brick.
