---
id: v1.0.0/adopt-ai-module-baseline
domain: ai
classification: migration
---

# Adopt AI Module Baseline

## Goal

A project that already ships AI features follows the v1.0.0 AI module baseline: module layout, rate limiting, and Langfuse tracing.

## Why

The v1.0.0 boilerplate ships AI helpers, rate limiting, structured generation/chat patterns, and tracing conventions. These are optional product capabilities — the point of this intention is to align projects that already have AI code, never to add AI to projects that don't.

## Applies When

- The project already has AI features (Vercel AI SDK usage, Langfuse, or a previous boilerplate AI module).
- The project intentionally tracks the `ai` domain.
- A human confirms that adopting the baseline AI conventions is desired.

## Do Not Apply When

- The project has no AI features — record as skipped, and do not add AI dependencies or modules.
- The project explicitly removed `ai` from `trackedDomains`.
- The project uses a custom AI provider abstraction that should not be replaced.
- Provider keys, tracing setup, or rate-limit behavior cannot be validated safely.

## Observable Gaps

Only proceed once the "Applies When" gate is confirmed by a human. Then work through each gap independently; skip any that is already closed.

1. **Module layout** — signal: the project's AI code does not follow the reference structure (`ai.service.ts`, `ai.providers.ts`, `ai.config.ts`, `contracts/`).
   Compare with the staged reference `apps/api/src/modules/ai/` and align naming and wiring only. Keep the project's prompts, models, and business logic exactly as they are.
   Done when: `pnpm --filter=api typecheck` passes.

2. **Rate limiting** — signal: AI endpoints are not guarded by an equivalent of `ai-rate-limit.middleware.ts`.
   Port the middleware pattern from the staged reference; keep the project's own quotas and limits.
   Done when: AI endpoints are covered and existing quota values are preserved.

3. **Tracing** — signal: the project uses Langfuse but `apps/api/src/instrument.ts` does not wire `LangfuseSpanProcessor` the way the reference does (shared TracerProvider with Sentry).
   Align only the OTEL/Langfuse wiring; keep the project's Sentry configuration.
   Done when: the API boots with instrumentation enabled and no duplicate tracer warnings.

## Out of Scope

- Adding AI capabilities to a project that has none.
- The project's prompts, model choices, providers, quotas, and AI business logic — never rewritten.
- Provider credentials and environments.

## Reference Paths

- `apps/api/src/modules/ai/` — **adapt**
- `apps/api/src/instrument.ts` — **adapt**
- `apps/documentation/src/content/docs/core-features/4_ai.mdx` — **adapt**

## Validation

- `pnpm --filter=api typecheck` passes.
- AI module tests pass if available.
- Missing provider credentials are reported as unavailable validation, not as passing.

## Record Result

Run `pnpm boilerplate upgrade record --id v1.0.0/adopt-ai-module-baseline --applied` after validation passes, or record it as skipped with a reason.
