---
id: v1.1.0/point-knip-at-auth-cli-mts
domain: tooling
classification: migration
---

# Point Knip At Auth CLI Mts

## Goal

Knip's API workspace entry for the Better Auth CLI script points at `src/modules/auth/auth.cli.mts`, matching the file that actually exists.

## Why

v1.0.0 already shipped `auth.cli.mts`, but `knip.json` still listed `auth.cli.ts`. The next release corrects that entry so Knip does not warn on a missing file or miss the real CLI script.

## Applies When

- The project tracks the `tooling` domain and runs Knip (`v1.0.0/adopt-knip` applied, or a root `knip` script plus `knip.json`).
- `knip.json` lists `apps/api` entry `src/modules/auth/auth.cli.ts` (or another `.ts` path) while the file on disk is `auth.cli.mts`.

## Do Not Apply When

- The project does not use Knip — record as skipped.
- The project has no Better Auth CLI script under `apps/api/src/modules/auth/`.
- The project's Knip entry already matches the on-disk filename.

## Observable Gaps

1. **Knip entry path** — signal: `knip.json` `workspaces["apps/api"].entry` contains `src/modules/auth/auth.cli.ts!` (or the same path without `!`) and that file does not exist.
   Change the entry to `src/modules/auth/auth.cli.mts!` to match the staged reference. Touch no other Knip workspace config.
   Done when: `pnpm knip` no longer reports that path as a missing file.

2. **On-disk script** — signal: the API still uses `auth.cli.ts` rather than `.mts`.
   This intention does **not** rename the script. If the project legitimately kept `.ts`, leave Knip pointing at `.ts` and record this intention as skipped with that reason.
   Done when: either the Knip entry matches `.mts` on disk, or the intention is skipped.

## Out of Scope

- Renaming or rewriting the Better Auth CLI script, `auth:generate`, or auth entities.
- Broader Knip rule/workspace edits.

## Reference Paths

- `knip.json` — **adapt**
- `apps/api/src/modules/auth/auth.cli.mts` — **adapt**

## Validation

- `pnpm knip` runs.
- The API Knip entry path exists on disk.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/point-knip-at-auth-cli-mts --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
