---
id: v1.0.0/adopt-ai-module-baseline
domain: ai
classification: migration
---

# Adopt AI Module Baseline

## Goal

Align a consumer project with the v1.0.0 AI module baseline only when that project intentionally uses the boilerplate AI domain.

## Why

The v1.0.0 boilerplate includes AI helpers, rate limiting, structured generation/chat patterns, and observability conventions. These are optional product capabilities, not mandatory infrastructure for every consumer project.

## Applies When

- The project already uses AI features, Langfuse, Vercel AI SDK patterns, or a previous boilerplate AI module.
- The project intentionally tracks the `ai` domain.
- A human confirms that adopting the baseline AI conventions is desired.

## Do Not Apply When

- The project does not have AI features.
- The project explicitly removed AI from `trackedDomains`.
- The project uses a custom AI provider abstraction that should not be replaced.
- Required provider keys, tracing setup, or rate-limit behavior cannot be validated safely.

## Reference Paths

- `apps/api/src/modules/ai/`
- `apps/api/src/modules/ai/README.md`
- `apps/documentation/src/content/docs/core-features/4_ai.mdx`
- `apps/api/src/instrument.ts`

## Suggested Agent Workflow

1. Check whether the project has AI code or intentionally tracks the `ai` domain.
2. If not, record the intention as skipped and do not add AI dependencies or modules.
3. If yes, compare the existing AI integration with the v1.0.0 reference.
4. Apply the smallest compatibility changes for rate limiting, structured output, and tracing.
5. Preserve project-specific prompts, providers, model choices, quotas, and business logic.

## Validation

- `pnpm --filter=api typecheck` passes.
- AI module tests pass if available.
- Missing provider credentials are reported as unavailable validation, not as passing.

## Record Result

Run `pnpm boilerplate upgrade record --id v1.0.0/adopt-ai-module-baseline --applied` after validation passes, or record it as skipped with a reason.
