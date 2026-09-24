---
id: unreleased/adopt-s3-storage-infrastructure
domain: storage
classification: migration
pr: 161
---

# Adopt Optional S3 Storage Infrastructure

## Goal

The API can store, download, and delete opaque files through a provider-neutral `StorageService`, backed by S3-compatible storage and disabled by default.

## Why

Business modules need file storage without coupling their contracts, authorization, or persistence rules to the AWS SDK. A small provider boundary keeps those concerns in the owning domain while allowing production S3 services and local RustFS to use the same API. Keeping storage disabled by default also prevents an unavailable object store from blocking applications that do not use files.

## Applies When

- The project tracks the `storage` domain and has an API app.
- The project needs S3-compatible file persistence, or already has business code that should move behind a provider-neutral storage service.
- The project can configure one default storage bucket for this infrastructure.

## Do Not Apply When

- The project has no API app — record as skipped.
- The project does not need file storage — record as skipped; do not add the capability only to match the boilerplate.
- The project already uses a custom storage abstraction or a non-S3 backend — stop and ask rather than replacing it.
- A human has explicitly decided to keep direct provider integration after reviewing this intention — record as skipped with that reason.

## Observable Gaps

1. **S3 client dependency** — signal: `apps/api/package.json` does not declare `@aws-sdk/client-s3`.
   Add only that runtime dependency at the range used by the staged reference. Do not align unrelated dependencies or copy the lockfile.
   Done when: the API package resolves `@aws-sdk/client-s3` and `pnpm --filter=api typecheck` passes.

2. **Provider-neutral storage module** — signal: `apps/api/src/modules/storage/storage.module.ts`, `storage.service.ts`, or `providers/storage-provider.interface.ts` is missing, or business services call the S3 client directly.
   Copy the staged `apps/api/src/modules/storage/` directory when no project-specific storage exists. Otherwise adapt its provider token, `StorageService`, and S3 provider boundary while preserving project-specific behavior.
   Done when: business code can inject `StorageService` for upload, download, and delete operations without importing the AWS SDK.

3. **Validated storage configuration** — signal: `apps/api/src/config/env.config.ts` has no `STORAGE_ENABLED` or `config.storage`, or storage credentials are read directly from `process.env` in a provider.
   Adapt the `STORAGE_*` schema and `config.storage` mapping from the staged reference. Add matching placeholders to the API and root env examples, preserving project-specific values and keeping `STORAGE_ENABLED=false` by default.
   Done when: the API validates all storage settings centrally and boots with storage disabled while the object store is unavailable.

4. **Domain integration with a stable API contract** — signal: a business module that needs files does not import `StorageModule`, conditionally registers file routes, or injects `StorageService` as optional.
   Follow the staged `posts.module.ts` pattern in the project's owning business module: always register `StorageModule` so routes and generated OpenAPI clients do not depend on deployment configuration. The module selects a disabled provider when `STORAGE_ENABLED=false`; file operations then return `503 Service Unavailable` without contacting S3. Keep HTTP routes, authorization, file metadata, and rollback behavior in the business module.
   Done when: the owning module always injects `StorageService`, its API contract is stable, and the disabled provider avoids all S3 calls.

5. **Local S3-compatible service** — signal: `docker-compose.yml` has no object storage service for local development, or it uses storage credentials unrelated to the API env.
   Adapt the staged RustFS service, ports, health check, and named volume. Reuse the API storage credentials and preserve existing Compose services and project port choices.
   Done when: `pnpm docker:up` starts a healthy S3-compatible endpoint that the enabled API can reach.

6. **Storage operating guidance** — signal: the project documentation does not explain the provider boundary, disabled-by-default behavior, local endpoint, or production bucket and credential expectations.
   Adapt the infrastructure, configuration, local RustFS, and production guidance from the staged file-storage page. Document the project's owning domain separately instead of copying the Posts example as a requirement.
   Done when: maintainers can tell how to enable, operate, and remove storage without reading provider implementation code.

## Out of Scope

- Copying the example Posts cover-image entity fields, migration, routes, contracts, tests, or frontend screens.
- Generated OpenAPI artifacts under `packages/openapi-generator/client/` and `packages/openapi-generator/tmp/`.
- Business-specific authorization, file metadata, upload validation, and database rollback rules.
- Replacing an existing custom storage system or migrating its stored objects.
- Updating unrelated dependencies or copying `pnpm-lock.yaml`.

## Reference Paths

- `apps/api/package.json` — **adapt**
- `apps/api/src/config/env.config.ts` — **adapt**
- `apps/api/src/modules/storage/` — **copy**
- `apps/api/src/modules/example/posts/posts.module.ts` — **adapt**
- `.env.example` — **adapt**
- `apps/api/.env.example` — **adapt**
- `docker-compose.yml` — **adapt**
- `apps/documentation/src/content/docs/core-features/3_filestorage.mdx` — **adapt**

## Validation

- `pnpm --filter=api typecheck` passes.
- `pnpm --filter=api test -- src/modules/storage` passes.
- The API boots with `STORAGE_ENABLED=false` while RustFS is stopped.
- With RustFS healthy and storage enabled, an upload, download, and delete cycle succeeds through `StorageService`.
- `pnpm fmt:check` passes.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/adopt-s3-storage-infrastructure --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
