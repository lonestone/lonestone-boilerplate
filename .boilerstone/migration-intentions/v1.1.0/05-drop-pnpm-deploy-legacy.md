---
id: v1.1.0/drop-pnpm-deploy-legacy
domain: ci
classification: migration
pr: 140
---

# Drop pnpm deploy --legacy

## Goal

Production Dockerfiles that run `pnpm deploy` do it without `--legacy`, and pass `--config.inject-workspace-packages=true` on that command so catalog peer dependencies still resolve.

## Why

pnpm catalogs apply only to workspace importers. `pnpm deploy --legacy` copies a workspace package and reinstalls it as an external package, so a peer such as `zod@catalog:validation` stays the literal string `catalog:validation`. Under `strictPeerDependencies: true` that fails even when the installed version is the catalog version.

Pinning the peer to a raw semver was rejected: the catalog is the source of truth. The pnpm 10 deploy path builds a dedicated lockfile from the shared lockfile, where the catalog is already resolved. That path requires injected workspace packages for the deploy command. Setting `injectWorkspacePackages` in `pnpm-workspace.yaml` would copy workspace packages on every local install; the flag stays on the Docker `pnpm deploy` line only so day-to-day installs keep symlinks.

## Applies When

- The project tracks the `ci` domain.
- Any `apps/*/Dockerfile` still runs `pnpm deploy --legacy`.

## Do Not Apply When

- The project has no Dockerfile that runs `pnpm deploy`.
- A human has explicitly decided to keep `--legacy` after reviewing this intention — record as skipped with that reason. Still having `--legacy` is **not** a skip condition.

## Observable Gaps

Work through each gap independently; skip any that is already closed.

1. **API image deploy** — signal: `apps/api/Dockerfile` contains `pnpm deploy --legacy`.
   Adapt the staged reference `apps/api/Dockerfile`. Keep the filter, destination, and `--prod`. Drop `--legacy`. Add `--config.inject-workspace-packages=true` on the same `pnpm deploy` line. Do not set `injectWorkspacePackages` in `pnpm-workspace.yaml`.
   Done when: `apps/api/Dockerfile` has no `deploy --legacy`, and its `pnpm deploy` line includes `--config.inject-workspace-packages=true`. Skip this gap if `apps/api/Dockerfile` does not exist.

2. **web-ssr image deploy** — signal: `apps/web-ssr/Dockerfile` contains `pnpm deploy --legacy`.
   Adapt the staged reference `apps/web-ssr/Dockerfile`. Keep the filter, destination, and `--prod`. Drop `--legacy`. Add `--config.inject-workspace-packages=true` on the same `pnpm deploy` line. Do not set `injectWorkspacePackages` in `pnpm-workspace.yaml`.
   Done when: `apps/web-ssr/Dockerfile` has no `deploy --legacy`, and its `pnpm deploy` line includes `--config.inject-workspace-packages=true`. Skip this gap if `apps/web-ssr/Dockerfile` does not exist.

## Out of Scope

- The GHCR workflow, image names, and tag matrix.
- `apps/web-spa/Dockerfile` — it does not run `pnpm deploy`.
- Root `package.json` lifecycle scripts, lefthook, and catalog entries themselves.
- Lockfiles (`pnpm-lock.yaml`) and generated artifacts.

## Reference Paths

- `apps/api/Dockerfile` — **adapt**
- `apps/web-ssr/Dockerfile` — **adapt**

## Validation

- No `apps/*/Dockerfile` contains `deploy --legacy`.
- Every `pnpm deploy` line in those Dockerfiles includes `--config.inject-workspace-packages=true`.
- `pnpm-workspace.yaml` does not set `injectWorkspacePackages`.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/drop-pnpm-deploy-legacy --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
