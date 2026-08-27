---
id: unreleased/filter-langfuse-spans
domain: ai
classification: migration
pr: 133
---

# Filter Langfuse Spans

## Goal

Every `LangfuseSpanProcessor` in `apps/api/src/instrument.ts` exports only LLM-related spans (`langfuse-sdk` and `ai`), including the Langfuse-without-Sentry path.

## Why

The v1.0.0 Langfuse-only branch started `NodeSDK` with an unfiltered `new LangfuseSpanProcessor()`. `OpenTelemetryModule` still instruments the whole Nest app on the same global provider, so controllers, guards, interceptors, HTTP and database spans were exported to Langfuse whenever Sentry was unset. The Sentry+Langfuse path already filtered; this change shares that filter through `createLangfuseSpanProcessor()` so both paths behave the same.

## Applies When

- The project tracks the `ai` domain, or `apps/api/src/instrument.ts` already wires `LangfuseSpanProcessor`.
- The Langfuse-only branch still uses `NodeSDK` with `new LangfuseSpanProcessor()`, or any `LangfuseSpanProcessor` lacks `shouldExportSpan` restricted to `langfuse-sdk` and `ai`. Still having the unfiltered processor is the starting state this intention migrates away from, not a skip reason.

## Do Not Apply When

- The project has no API app, or no `apps/api/src/instrument.ts`.
- The project does not use Langfuse — record as skipped, and do not add Langfuse.
- The project uses a custom OpenTelemetry / Langfuse bootstrap that is not this file — stop and ask rather than rewriting it.
- A human has explicitly decided to keep exporting non-LLM spans to Langfuse after reviewing this intention — record as skipped with that reason.

## Observable Gaps

1. **Langfuse-only processor** — signal: the `!config.sentry.dsn && config.langfuse.secretKey` branch constructs `new NodeSDK({ spanProcessors: [new LangfuseSpanProcessor()] })` (no `shouldExportSpan`).
   Replace that construction with `new NodeTracerProvider({ spanProcessors: [createLangfuseSpanProcessor()] })` and `provider.register()`, matching the staged reference `apps/api/src/instrument.ts`. Keep the project's Sentry-only branch untouched.
   Done when: that branch no longer imports or starts `NodeSDK`.

2. **Shared factory** — signal: `createLangfuseSpanProcessor` is missing, or the Sentry+Langfuse branch still inlines `new LangfuseSpanProcessor({ … shouldExportSpan … })`.
   Extract the factory as in the staged reference and use it on every Langfuse path. Pass the project's existing Langfuse public/secret/host/environment values; do not invent new config keys.
   Done when: both Langfuse paths call `createLangfuseSpanProcessor()` and there is a single `shouldExportSpan` implementation.

3. **Instrumentation scopes** — signal: `shouldExportSpan` is absent, or it allows scopes other than `langfuse-sdk` and `ai`.
   Restrict the filter to those two scope names, matching `LANGFUSE_INSTRUMENTATION_SCOPES` in the staged reference.
   Done when: grepping `instrument.ts` shows the filter includes both names and no other instrumentation scopes.

4. **AI tracing docs** — signal: `apps/documentation/src/content/docs/core-features/4_ai.mdx` (or the project's equivalent) does not mention that the Langfuse filter applies when Langfuse runs without Sentry.
   Adapt the short note from the staged reference. Do not rewrite the rest of the AI page.
   Done when: the page states that the filter applies on the Langfuse-only path because `OpenTelemetryModule` shares the global provider.

## Out of Scope

- The Sentry-only initialization path, DSN handling, and Sentry sampling.
- `OpenTelemetryModule` registration in `app.module.ts`.
- AI module layout, prompts, providers, rate limits, and business logic — those remain `v1.0.0/adopt-ai-module-baseline`.
- Langfuse credentials, host, and environment values.
- Which spans Sentry receives (AI traces still appear in Sentry when both are enabled).

## Reference Paths

- `apps/api/src/instrument.ts` — **adapt**
- `apps/documentation/src/content/docs/core-features/4_ai.mdx` — **adapt**

## Validation

- `pnpm --filter=api typecheck` passes.
- The API boots with Langfuse configured and without a Sentry DSN (Langfuse-only path).
- `instrument.ts` has no `NodeSDK` import and every `LangfuseSpanProcessor` is created through `createLangfuseSpanProcessor()`.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/filter-langfuse-spans --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
