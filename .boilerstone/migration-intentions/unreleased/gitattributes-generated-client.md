---
id: unreleased/gitattributes-generated-client
domain: tooling
classification: migration
---

# Mark the generated OpenAPI client as generated

## Goal

GitHub collapses the committed OpenAPI client in pull request diffs and leaves it out of the repository's language stats.

## Why

The client under `packages/openapi-generator/client/` stays committed: `pnpm generate` needs the API running, and CI, the Docker builds and a fresh clone build against the committed copy. But it weighs tens of thousands of lines, so every contract change buries the hand-written code of a pull request under the regenerated types. `linguist-generated` collapses those files in the review while keeping their diff one click away, and keeps `git diff` untouched locally.

## Applies When

- The project commits a generated OpenAPI client (`*.gen.ts` files under `packages/openapi-generator/`, or wherever the project's `openapi-ts` config writes them).

## Do Not Apply When

- The project does not commit its generated client (it is git-ignored and generated at build time).

## Observable Gaps

1. **Generated attribute** — signal: `git check-attr linguist-generated -- packages/openapi-generator/client/types.gen.ts` prints `unspecified`.
   Add the line from the staged reference `.gitattributes` to the project's `.gitattributes` (create it if missing), with one line per output directory if the project generates several clients.
   Done when: `git check-attr linguist-generated` prints `true` for every committed `*.gen.ts` file, and `unspecified` for the generator's own sources (`openapi-ts.config.ts`, `preprocess/`).

## Out of Scope

- Whether to commit the generated client.
- `-diff` or any other attribute that would hide the client from `git diff`.

## Reference Paths

- `.gitattributes` — **adapt**

## Validation

- `git check-attr linguist-generated -- $(git ls-files '*.gen.ts')` prints `true` for each file.

## Record Result

Run `pnpm boilerplate upgrade record --id vX.Y.Z/gitattributes-generated-client --applied` after validation passes, or record it as skipped with a reason.
