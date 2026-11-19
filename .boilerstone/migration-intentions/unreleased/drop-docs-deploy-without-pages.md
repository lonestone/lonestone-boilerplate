---
id: unreleased/drop-docs-deploy-without-pages
domain: ci
classification: migration
---

# Remove the docs deploy workflow when the documentation is not published

## Goal

A project that does not publish its documentation on GitHub Pages has no `.github/workflows/deploy-docs.yml`. The documentation app stays.

## Why

The workflow "Deploy documentation to GitHub Pages" runs on every push to the default branch that touches `apps/documentation/**`, and on every release. On a repository where Pages is not enabled, it fails each time with "Ensure GitHub Pages has been enabled". The failures hide real ones. New projects now answer a question at `init` (`--public-docs yes|no`), and a "no" never gets the workflow. Existing projects need the same cleanup by hand. Fixing the failure by enabling Pages instead was rejected for projects that keep their documentation private.

## Applies When

- The project tracks the `ci` domain.
- `.github/workflows/deploy-docs.yml` exists.
- The project does not publish its documentation on GitHub Pages: Pages is not enabled on the repository, or the team has no plan to publish. Ask the human if this is not clear.

## Do Not Apply When

- The project publishes its documentation on GitHub Pages and wants to keep doing so. Record as skipped with that reason.
- The workflow was already removed.

## Observable Gaps

1. **Deploy workflow** — signal: `.github/workflows/deploy-docs.yml` exists.
   Delete it.
   Done when: `test ! -e .github/workflows/deploy-docs.yml`.

2. **Leftover references** — signal: `rg -n "deploy-docs|Deploy documentation to GitHub Pages" --glob '!node_modules' --glob '!CHANGELOG.md'` finds a match (a README badge, a rule file, another workflow).
   Remove each reference. Keep the documentation app and its `site` and `base` settings.
   Done when: the same command finds nothing.

## Out of Scope

- The documentation app `apps/documentation` and its content.
- Disabling GitHub Pages in the repository settings.
- Any other workflow.

## Reference Paths

- `.github/workflows/deploy-docs.yml` — **adapt**

## Validation

- `actionlint` reports nothing on the remaining workflows (for example `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest`).
- The next push to the default branch shows no "Deploy documentation to GitHub Pages" run.

## Record Result

Run `pnpm boilerplate upgrade record --id vX.Y.Z/drop-docs-deploy-without-pages --applied` after validation passes, or record it as skipped with a reason.
