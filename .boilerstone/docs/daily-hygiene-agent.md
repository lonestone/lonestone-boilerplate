# Daily Boilerstone hygiene (report + prepare next release draft)

This file is the producer-only prompt for the scheduled maintainer agent. `pnpm rock` removes it from consumer projects. It does **not** publish a release.

## Mission

Keep the next unpublished release ready by maintaining:

1. `CHANGELOG.md` `## [Unreleased]` coverage for consumer-visible changes since the last tag
2. `.boilerstone/migration-intentions/` draft intentions for the **next** SemVer (not yet released)
3. Mechanical documentation / script / producer-artifact drift that would mislead humans or agents

Do **not** stamp a version, create a git tag, push tags, or run `pnpm boilerplate changelog release`.

## Allowed

- Edit `CHANGELOG.md` under `## [Unreleased]` only
- Create/update draft intentions under `.boilerstone/migration-intentions/vNEXT/`
- Run `pnpm boilerplate intentions sync` and `pnpm boilerplate intentions lint`
- Fix **mechanical** drift: dead package/script references, wrong paths in docs/rules, architecture tree mismatches, README commands that do not exist, duplicate `AGENTS.md`/`CLAUDE.md`
- Regenerate `apps/documentation/INDEX.md` via the project script if docs pages changed
- Open **one draft PR** when there are real changes; if nothing to do, exit with a short “no-op” summary and do not open an empty PR

## Forbidden

- Release tagging or `changelog release --to …`
- Unbounded dependency upgrades / `pnpm update` / catalog-wide bumps
- Creating or editing MikroORM SQL migrations under `apps/api/**/migrations/`
- Regenerating OpenAPI clients (requires a running API)
- Refactoring application features, auth, AI, UI behavior “while you’re here”
- Inventing product changes; only reflect what already landed on `main`
- Force-pushing, amending other authors’ commits, or merging the PR

## Procedure (summary)

1. Confirm producer mode (`.boilerstone/migration-intentions/` exists). Fetch tags; `PREV` = latest `v*` SemVer tag.
2. Inventory `## [Unreleased]` against `git log` / `git diff --name-status $PREV..origin/main`. Fill changelog holes (meaning, not commit subjects). Do not rename `[Unreleased]`.
3. Draft or refresh intentions for the next SemVer (`vNEXT/`). Default next **minor** for new capabilities/conventions; **patch** for fixes/docs/tooling; **major** only if clearly breaking — if unsure, `NEEDS-HUMAN` and use minor + `breaking-manual`. One intention per bounded adaptation. Never an unbounded “update dependencies” intention.
4. `pnpm boilerplate intentions sync` and `pnpm boilerplate intentions lint`.
5. Mechanical drift pass only (architecture tree, dead scripts, Docker vs compose, DB commands vs `apps/api/package.json`, linter docs, generated OpenAPI filenames, engines pins, `.cursor/rules` paths, `AGENTS.md`/`CLAUDE.md`, `PRODUCER_ARTIFACTS` vs `PRODUCER_FILES_TO_REMOVE`).
6. Validate: intentions lint, `pnpm fmt:check` or `pnpm fmt`, generate docs index if docs pages changed, Boilerstone CLI tests if CLI files changed.
7. Open one draft PR titled `chore(boilerstone): daily hygiene YYYY-MM-DD` if there is real work; otherwise no-op.

The canonical inventory and classification rules are in [release-maintainer-runbook.md](./release-maintainer-runbook.md). Intention shape is [TEMPLATE.md](../migration-intentions/TEMPLATE.md).
