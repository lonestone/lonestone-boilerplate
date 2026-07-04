# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-02

### Added

#### Project baseline

- Initial Lonestone monorepo boilerplate release.
- PNPM workspace with API, SPA, SSR frontend, documentation app, shared UI package, i18n package, OpenAPI generator, and schematics package.
- Standardized root scripts for development, build, typecheck, lint, formatting, tests, OpenAPI generation, Docker services, and documentation.
- Docker Compose development services for PostgreSQL, MailDev, and MinIO.
- Automated setup script (`pnpm rock`) for generated projects: package renaming, environment file setup, local ports, Docker prompts, migration prompts, and consumer cleanup.

#### Backend

- NestJS API application with MikroORM/PostgreSQL integration.
- Better Auth integration with session handling, auth guards, and database adapter tests.
- Example posts module with entities, controllers, e2e tests, filtering, sorting, and pagination patterns.
- Email module with SMTP/MailDev development setup.
- File storage support through S3-compatible local development infrastructure.
- AI module with rate limiting, structured generation/chat helpers, and Langfuse/Vercel AI SDK oriented patterns.
- OpenTelemetry tracing with Sentry and Langfuse integration.

#### Frontend

- React SPA and React Router SSR applications.
- Shared UI component package with primitives and reusable app components.
- Authentication UI flow and example user posts feature.
- Shared i18n package for frontend localization.
- OpenAPI-generated frontend contracts and SDK workflow.

#### Documentation and tooling

- Starlight documentation app with architecture, general, frontend, backend, and feature guides.
- Documentation index generation for agent-readable navigation.
- Oxlint and oxfmt configuration for repository-wide static checks and formatting.
- Vitest setup for unit and e2e tests.
- GitHub Actions documentation and CI/CD workflow templates.

#### Boilerplate upgrade system

- Migration intentions framework for human-supervised AI agents.
- Consumer project tracking via `.boilerstone/boilerplate.json`, including source version and source commit when known.
- Boilerplate lifecycle CLI: `bootstrap`, `versions list`, `upgrade status`, `upgrade path`, `upgrade prepare`, `upgrade record`, `upgrade finish`, `intentions lint`, and `intentions sync`.
- Curl installer with `init`, `onboard`, and `upgrade` entry points.
- Claude Code and Cursor skills for the supervised upgrade workflow.
- Upgrade runbook and generated upgrade session prompt for one-intention-at-a-time execution.

### Changed

- `v1.0.0/setup-boilerplate-tracking` is informational: onboarding is handled by `bootstrap`/`onboard` before normal upgrade paths are computed.
- Upgrade execution records intention outcomes through CLI commands instead of manual JSON edits.
- `source.currentVersion` is updated only through `upgrade finish`, after all intentions in an upgrade range are applied or skipped.

### Security

- Hardened `install.sh` for `curl | sh` usage by deferring execution to `main "$@"`, avoiding `$0`-based usage output, validating positional arguments, and handling `/dev/tty` safely.

### Migration

- No migration required for new projects.
- Existing projects that predate the upgrade system should run `onboard`/`bootstrap` to create `.boilerstone/boilerplate.json` before preparing future upgrades.
- Existing projects can then apply only the v1.0.0 baseline intentions that match their tracked domains and applicability checks, such as Oxlint/Oxfmt tooling, MikroORM v7, Better Auth MikroORM persistence, or optional AI module conventions.
- Optional capabilities are not forced. For example, projects that do not use AI should not track the `ai` domain and should skip the AI baseline intention.
- See [migration intentions](./.boilerstone/migration-intentions/v1.0.0/README.md) for the v1.0.0 classification.
