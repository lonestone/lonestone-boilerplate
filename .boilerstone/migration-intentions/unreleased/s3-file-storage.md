---
id: unreleased/s3-file-storage
domain: storage
classification: informational
---

# S3 File Storage

## Goal

Let an existing project know that the boilerplate now ships an opt-in S3 file storage layer, so a human can decide whether to adopt it.

## Why

File storage was a documentation TODO. Projects that needed files each wrote their own S3 module, and the old test setup already exported `S3_*` variables for MinIO, so some projects carry their own implementation.

The new layer splits storage into two modules. `StorageModule` moves bytes and signs download URLs, and knows nothing about the database. `MediaModule` owns a `media` table and keeps each row in sync with its object in the bucket, so business services never clean up objects themselves. Files are served through signed URLs, not streamed through the API. Signing is rounded to a fixed time window so the same URL comes back for a while and browsers can cache images.

This is informational, not a migration. A project with its own S3 module has its own table, keys and routes. Replacing them means migrating stored data, and only a human can decide that. Storage stays disabled by default, so a project that ignores this intention is not affected.

## Applies When

- The project has the `api` app.
- The project stores or plans to store user files.

## Do Not Apply When

- The project does not track the `storage` domain.
- A human decided to keep the project's own storage module after review.

## Observable Gaps

1. **Storage modules** — signal: `apps/api/src/modules/storage/` and `apps/api/src/modules/media/` are missing. Compare with the reference paths below. Done when: a human has decided to adopt them, or to keep the existing storage.
2. **Configuration** — signal: no `STORAGE_ENABLED` in `apps/api/src/config/env.config.ts`. Done when: the decision above is reflected in the config, or the gap is left on purpose.
3. **Local service** — signal: no `rustfs` service in `docker-compose.yml`. Done when: the project has an S3-compatible local service, or does not need one.

## Out of Scope

- Data stored by an existing storage module: never moved automatically.
- Business entities and routes that reference files.
- Upload routes: they arrive with a later change.

## Reference Paths

- `apps/api/src/modules/storage/` — **adapt**
- `apps/api/src/modules/media/` — **adapt**
- `apps/documentation/src/content/docs/core-features/3_filestorage.mdx` — **copy**

## Validation

- `pnpm typecheck` passes.
- The API starts with `STORAGE_ENABLED=false`.
- When adopted: `pnpm --filter @boilerstone/api test` passes, including the RustFS integration test.

## Record Result

Informational intentions are dropped from the upgrade plan. Nothing to record.
