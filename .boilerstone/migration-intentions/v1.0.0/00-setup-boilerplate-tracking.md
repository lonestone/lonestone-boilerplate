---
id: v1.0.0/setup-boilerplate-tracking
domain: tooling
classification: informational
---

# Setup Boilerplate Tracking

## Goal

Document the bootstrap step that initializes boilerplate upgrade tracking in an existing project.

## Why

Older projects created before the upgrade system cannot resolve or prepare migration intentions until they declare their source boilerplate version and tracked domains. This is handled by `bootstrap`/`onboard`, before an upgrade path is computed, so this file is informational and is not replayed as a normal migration intention.

This avoids the circular flow where an intention would be required to create the very state file needed to resolve intentions.

## Applies When

- The project was created from, or strongly resembles, `lonestone/lonestone-boilerplate`.
- The project is being onboarded with `bootstrap` or `install.sh onboard`.
- The project does not have `.boilerstone/boilerplate.json` yet.
- A human can provide or validate the source boilerplate version used by the project.

## Do Not Apply When

- The project was not based on `lonestone/lonestone-boilerplate`.
- The project already has `.boilerstone/boilerplate.json`.
- The source boilerplate version cannot be determined safely.

## Reference Paths

- `.boilerstone/boilerplate.example.json` — **copy**
- `.boilerstone/boilerplate.schema.json` — **copy**
- `.boilerstone/docs/upgrade-runbook.md` — **copy**

## Suggested Agent Workflow

1. Run `install.sh onboard` from the project root, or fetch `.boilerstone/` and run `pnpm dlx tsx .boilerstone/cli/boilerplate.ts bootstrap`.
2. Confirm or enter the oldest known boilerplate version for the project.
3. Review `.boilerstone/boilerplate.json` in the consumer project.
4. Adjust `trackedDomains` only if the project intentionally excludes domains such as `api`, `frontend`, `ci`, `docker-env`, `auth`, `email`, `storage`, `monitoring`, or `ai`.
5. Commit the new `.boilerstone/` integration before preparing later migrations.

## Validation

- `pnpm boilerplate upgrade status --project <project-path> --json` reports `initialized: true`.
- `pnpm boilerplate upgrade path --project <project-path> --to <target-version> --json` returns a valid path.

## Record Result

Do not add this ID to `intentions.applied`. The existence of `.boilerstone/boilerplate.json` is the record that bootstrap completed.
