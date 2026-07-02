# Migration Intentions - v1.0.0

v1.0.0 is the baseline release of the whole boilerplate in its current shape: monorepo structure, API, frontends, shared packages, documentation, development tooling, Docker services, and the boilerplate upgrade system itself.

Because this is the baseline, most of the project is classified as `no-migration`: new projects receive it directly from the template. Older projects can still have actionable gaps against the baseline. Those gaps are represented as domain-scoped intentions and must be applied only when the project actually uses the relevant domain and passes the intention's applicability checks.

## Intentions

- [setup-boilerplate-tracking](./setup-boilerplate-tracking.md) - Documents the bootstrap tracking state created before normal upgrades.
- [standardize-oxlint-oxfmt](./standardize-oxlint-oxfmt.md) - Align lint and format tooling with Oxlint/Oxfmt when the project follows boilerplate tooling.
- [migrate-mikro-orm-v7](./migrate-mikro-orm-v7.md) - Align an API project with the MikroORM v7 baseline.
- [align-better-auth-mikro-orm-adapter](./align-better-auth-mikro-orm-adapter.md) - Align Better Auth persistence when the project uses Better Auth with MikroORM.
- [adopt-ai-module-baseline](./adopt-ai-module-baseline.md) - Adopt the AI module baseline only when the project intentionally tracks AI capabilities.

## Classification

- `informational`: `setup-boilerplate-tracking` is handled by `bootstrap`/`onboard`, not by `upgrade prepare`.
- `no-migration`: the full project baseline is shipped as the initial template state for new projects.
- `migration`: selected baseline gaps for older projects, filtered by `trackedDomains` and each intention's "Do Not Apply When" section.

For example, a project that does not use AI should not track the `ai` domain. Even if the intention is visible during manual review, `adopt-ai-module-baseline` explicitly tells the executor to skip instead of adding AI infrastructure.
