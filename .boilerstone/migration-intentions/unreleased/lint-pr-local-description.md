---
id: unreleased/lint-pr-local-description
domain: tooling
classification: migration
requires:
  - v1.1.0/adopt-conventional-commits
---

# Lint a PR title and description locally, before the PR exists

## Goal

`pnpm lint:pr --title "<title>" --body-file <file>` runs the CI checks on a title and a description that are not on GitHub yet, and the contributor docs say to run it before `gh pr create`.

## Why

`scripts/lint-pr.ts` only read a GitHub event JSON. An author could not check a description before opening the pull request. In one project, 2 of 14 pull requests failed only in CI, on their description.

The new mode reuses the same checks, so local and CI results cannot differ. It treats the pull request as not a draft, which is the strict case. `--body-file -` reads stdin, so an agent can pipe the text without a file. The CI mode (event file argument or `GITHUB_EVENT_PATH`) is unchanged.

A separate script was rejected: two scripts would drift apart.

## Applies When

- The project tracks the `tooling` domain.
- `scripts/lint-pr.ts` exists and reads only an event file (no `--body-file` option).

## Do Not Apply When

- The project has no `scripts/lint-pr.ts`. Apply `v1.1.0/adopt-conventional-commits` first.
- The project changed the lint rules in `scripts/lint-pr.ts` heavily. Compare first, and ask a human.

## Observable Gaps

1. **Local mode** — signal: `rg "body-file" scripts/lint-pr.ts` has no match.
   Add the `--title` and `--body-file` options as in the staged reference. Keep the project's own rules and messages. Touch no other function.
   Done when: `pnpm lint:pr --title "ci(tooling): test" --body-file <file>` reports a clean description for a valid file, and exits with code 1 for a file that holds a task list.

2. **Contributor docs** — signal: `rg "lint:pr --title" CONTRIBUTING.md` has no match.
   Add the line that tells authors to run the command before `gh pr create`, next to the description rules.
   Done when: `rg "lint:pr --title" CONTRIBUTING.md` matches.

3. **Finalize skill** — signal: step "Validate locally" in `.claude/skills/finalize-pr/SKILL.md` or `.cursor/skills/finalize-pr/SKILL.md` still says `pnpm lint:pr <event.json>`.
   Replace it with the `--title` and `--body-file` form, in both copies.
   Done when: `rg "event.json" .claude/skills/finalize-pr .cursor/skills/finalize-pr` has no match.

## Out of Scope

- The lint rules themselves, and `commitlint.config.ts`.
- `.github/workflows/pr-lint.yml`: CI keeps reading the event file.
- Any other script.

## Reference Paths

- `scripts/lint-pr.ts` — **adapt**
- `CONTRIBUTING.md` — **adapt**
- `.claude/skills/finalize-pr/SKILL.md` — **adapt**
- `.cursor/skills/finalize-pr/SKILL.md` — **adapt**

## Validation

- `pnpm exec tsc -p scripts/tsconfig.json` passes.
- `pnpm lint:pr --title "ci(tooling): test" --body-file <file>` is clean for a valid description and fails for an invalid one.
- `pnpm lint:pr <event.json>` still works.
- `pnpm lint:pr --body-file -` fails with a message that asks for `--title`.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/lint-pr-local-description --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
