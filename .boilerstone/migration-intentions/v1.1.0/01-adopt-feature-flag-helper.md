---
id: v1.1.0/adopt-feature-flag-helper
domain: api
classification: migration
---

# Adopt Feature Flag Helper

## Goal

The API can ship a merged change dark with one helper, `isFeatureEnabled`, reading `FEATURE_<NAME>` from the environment (`true` or `1` only). Unknown flags are off and are not added to the Zod env schema.

## Why

The boilerplate added a single-helper convention so two changes can merge while only one reaches production. It is not a flag platform: no dashboard, no schema entries per flag. Projects that already have another flag system should not be forced onto this helper.

## Applies When

- The project tracks the `api` domain and has the NestJS API app.
- `apps/api/src/config/feature-flag.ts` is missing, or feature checks are inlined as ad-hoc `process.env.FEATURE_*` reads with no shared helper.

## Do Not Apply When

- The project has no `api` app.
- The project already uses another feature-flag system (LaunchDarkly, Unleash, a custom module) and a human wants to keep it — record as skipped with that reason.
- The project does not want env-var feature flags at all — record as skipped with that reason.

## Observable Gaps

1. **Helper module** — signal: `apps/api/src/config/feature-flag.ts` does not exist (or has no `isFeatureEnabled`).
   Copy the staged reference. Do not wire it into existing business features unless a human asked.
   Done when: `import { isFeatureEnabled } from 'src/config/feature-flag'` typechecks and `isFeatureEnabled('billing')` reads `FEATURE_BILLING`.

2. **Unit tests** — signal: `apps/api/src/config/feature-flag.spec.ts` is missing.
   Copy the staged spec. Do not expand coverage beyond the helper.
   Done when: `pnpm --filter=api test -- src/config/feature-flag.spec.ts` (or the project's equivalent) passes.

3. **Env example** — signal: `apps/api/.env.example` has no commented `FEATURE_*` illustration, or it commits a real enabled flag.
   Adapt the staged `.env.example` comment only. Do not add flags to the Zod env schema.
   Done when: the example is commented, and `env.config.ts` does not list `FEATURE_*` keys.

4. **Docs** — signal: `apps/documentation/src/content/docs/guides/feature-flags.mdx` is missing.
   Copy the staged page if the documentation app exists. Skip this gap when the project has no docs app.
   Done when: the guide exists or the docs app is absent.

## Out of Scope

- Turning flags on in production or adding GitHub Environment secrets.
- Rewriting existing features to hide them behind flags.
- The Promote workflow and release-please — `unreleased/adopt-release-please`.
- Cherry-pick / release-branch escape hatches beyond pointing at the runbook.

## Reference Paths

- `apps/api/src/config/feature-flag.ts` — **copy**
- `apps/api/src/config/feature-flag.spec.ts` — **copy**
- `apps/api/.env.example` — **adapt**
- `apps/documentation/src/content/docs/guides/feature-flags.mdx` — **copy**

## Validation

- `pnpm --filter=api test -- src/config/feature-flag.spec.ts` passes when the API test runner exists.
- `pnpm --filter=api typecheck` passes.
- No `FEATURE_*` keys were added to the Zod env schema.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/adopt-feature-flag-helper --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
