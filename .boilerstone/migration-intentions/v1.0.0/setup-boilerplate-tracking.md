---
id: v1.0.0/setup-boilerplate-tracking
domain: tooling
classification: migration
---

# Setup Boilerplate Tracking

## Goal

Initialize boilerplate upgrade tracking in an existing project that does not yet have `.boilerstone/boilerplate.json`.

## Why

Older projects created before the upgrade system cannot resolve or prepare migration intentions until they declare their source boilerplate version and tracked domains.

## Applies When

- The project was created from, or strongly resembles, `lonestone/lonestone-boilerplate`.
- The project does not have `.boilerstone/boilerplate.json`.
- A human can provide or validate the source boilerplate version used by the project.

## Do Not Apply When

- The project was not based on `lonestone/lonestone-boilerplate`.
- The project already has `.boilerstone/boilerplate.json`.
- The source boilerplate version cannot be determined safely.

## Reference Paths

- `.boilerstone/boilerplate.example.json`
- `.boilerstone/boilerplate.schema.json`
- `.boilerstone/docs/upgrade-runbook.md`

## Suggested Agent Workflow

1. Run `pnpm boilerplate upgrade init --project <project-path>` from a checkout of `lonestone/lonestone-boilerplate`.
2. Confirm or enter the oldest known boilerplate version for the project.
3. Review `.boilerstone/boilerplate.json` in the consumer project.
4. Adjust `trackedDomains` only if the project intentionally excludes domains such as `api`, `frontend`, `ci`, or `docker-env`.
5. Commit the new `.boilerstone/boilerplate.json` file before preparing later migrations.

## Validation

- `pnpm boilerplate upgrade status --project <project-path> --json` reports `initialized: true`.
- `pnpm boilerplate upgrade path --project <project-path> --to <target-version> --json` returns a valid path.

## Record Result

Add intention ID `v1.0.0/setup-boilerplate-tracking` to `intentions.applied` after validation passes.
