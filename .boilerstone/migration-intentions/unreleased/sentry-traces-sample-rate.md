---
id: unreleased/sentry-traces-sample-rate
domain: monitoring
classification: migration
pr: 156
---

# Disable Sentry traces unless TRACES_SAMPLE_RATE is set

## Goal

Sentry `tracesSampleRate` comes from `TRACES_SAMPLE_RATE` (0–1). The default is `0`, so errors and logs still flow while traces stay off until a project opts in.

## Why

A DSN used to turn traces on at 100% in development and 10% in production. That is expensive for a boilerplate default. A numeric env var is the opt-in, not a second boolean: `0` disables traces, `0.1` is a typical production rate, `1.0` sends everything.

## Applies When

- The project has `apps/api/src/instrument.ts` (or equivalent) that calls `Sentry.init` with a `tracesSampleRate`.
- `tracesSampleRate` is still hardcoded (for example `config.env === 'production' ? 0.1 : 1.0`), or `TRACES_SAMPLE_RATE` is missing from the API env schema. Still having the hardcoded rate is the starting state this intention migrates away from, not a skip reason.

## Do Not Apply When

- The project has no API app, or no Sentry bootstrap file.
- The project does not use Sentry — record as skipped, and do not add Sentry.
- The project uses a custom OpenTelemetry / Sentry bootstrap that is not this file — stop and ask rather than rewriting it.
- A human has explicitly decided to keep a hardcoded sample rate after reviewing this intention — record as skipped with that reason.

## Observable Gaps

1. **Env schema** — signal: `apps/api/src/config/env.config.ts` has no `TRACES_SAMPLE_RATE`.
   Add `TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0)` next to `SENTRY_DSN`, matching the staged reference. Do not rename or remove the DSN key.
   Done when: the schema parses `TRACES_SAMPLE_RATE` and missing/unset values become `0`.

2. **Config object** — signal: `config.sentry` has no `tracesSampleRate`.
   Expose `tracesSampleRate: configParsed.data.TRACES_SAMPLE_RATE` on `config.sentry`, matching the staged reference.
   Done when: `config.sentry.tracesSampleRate` exists and is a number.

3. **Sentry init** — signal: `apps/api/src/instrument.ts` still sets `tracesSampleRate` from `config.env` (or another hardcoded number) instead of `config.sentry.tracesSampleRate`.
   Pass `tracesSampleRate: config.sentry.tracesSampleRate`. Leave the Sentry/Langfuse branching and processors unchanged.
   Done when: grepping `instrument.ts` shows `config.sentry.tracesSampleRate` and no `production ? 0.1 : 1.0` (or equivalent) sample-rate ternary.

4. **Example env** — signal: `apps/api/.env.example` has no `TRACES_SAMPLE_RATE=0`.
   Add that line under the Sentry block, matching the staged reference. Do not invent a DSN.
   Done when: `.env.example` contains `TRACES_SAMPLE_RATE=0`.

5. **Monitoring docs** — signal: `apps/documentation/src/content/docs/core-features/2_monitoring.mdx` (or the project's equivalent) still tells people that traces are captured automatically, or still shows a hardcoded `tracesSampleRate: 1.0`.
   Adapt the staged reference: traces stay off at `0`; set `TRACES_SAMPLE_RATE` above `0` to opt in. Do not rewrite the rest of the monitoring page.
   Done when: the page documents `TRACES_SAMPLE_RATE` and states that `0` is the default.

## Out of Scope

- Sentry DSN handling, Pino logs, and error reporting.
- Langfuse processors, `skipOpenTelemetrySetup`, and the shared TracerProvider branching — those remain `unreleased/filter-langfuse-spans` / `v1.0.0/adopt-ai-module-baseline`.
- `OpenTelemetryModule` registration and `@Traceable()` usage.
- Frontend Sentry config in web-spa / web-ssr.

## Reference Paths

- `apps/api/src/config/env.config.ts` — **adapt**
- `apps/api/src/instrument.ts` — **adapt**
- `apps/api/.env.example` — **adapt**
- `apps/documentation/src/content/docs/core-features/2_monitoring.mdx` — **adapt**

## Validation

- `pnpm --filter=api typecheck` passes.
- The API boots with a Sentry DSN and without `TRACES_SAMPLE_RATE` set (traces stay off).
- `instrument.ts` reads `config.sentry.tracesSampleRate`.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/sentry-traces-sample-rate --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
