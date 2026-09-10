# Rösti

Multi-club team manager: seasons, recurring matches, RSVP, blue/red lineups, goals and assists, match chat, notifications, and peer-to-peer session fee tracking.

| App | Role |
|-----|------|
| `apps/api` | NestJS REST API (auth, clubs, matches, stats, chat, payments stub) |
| `apps/web-spa` | Authenticated web app (desktop + Capacitor mobile shell) |
| `apps/web-ssr` | Public landing, invite links, privacy page |
| `apps/documentation` | Product and engineering docs |

## Prerequisites

- [Node.js](https://nodejs.org/) **24.13.0** (see `engines` in root `package.json`)
- [pnpm](https://pnpm.io/) **10.28.2**
- [Docker](https://www.docker.com/) and Docker Compose

With [fnm](https://github.com/Schniz/fnm):

```bash
fnm use 24.13.0
corepack enable
corepack prepare pnpm@10.28.2 --activate
```

## First-time setup

From the repository root:

```bash
pnpm install
pnpm rock
```

`pnpm rock` walks you through:

- Database credentials (Postgres)
- App ports and API URL
- SMTP (MailDev for local email)
- Writing / updating `.env` files
- Optionally starting Docker and running migrations

Then start everything:

```bash
pnpm docker:up          # if rock did not already start Docker
pnpm --filter=@pitchkit/api db:migrate:up
pnpm dev
```

Typical local URLs (exact ports come from your `.env`):

- API — OpenAPI docs at `/docs`
- Web app (`web-spa`) — login / register / clubs / matches
- Public site (`web-ssr`) — landing and `/invite/:invitationId`
- MailDev UI — catch verification and invite emails in development

### Manual setup (alternative)

If you prefer not to use `pnpm rock`:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web-spa/.env.example apps/web-spa/.env
cp apps/web-ssr/.env.example apps/web-ssr/.env
cp packages/openapi-generator/.env.example packages/openapi-generator/.env
```

Align `API` URL/port across those files, then:

```bash
pnpm docker:up
pnpm --filter=@pitchkit/api db:migrate:up
pnpm dev
```

See [Env files](apps/documentation/src/content/docs/core-features/0_env-file.mdx) for details.

## Useful commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Run all apps in development |
| `pnpm --filter=@pitchkit/api dev` | API only |
| `pnpm --filter=@pitchkit/web-spa dev` | Web app only |
| `pnpm --filter=@pitchkit/web-ssr dev` | Public site only |
| `pnpm docs-only` | Documentation site |
| `pnpm docker:up` / `docker:down` / `docker:logs` | Local Postgres + MailDev |
| `pnpm --filter=@pitchkit/api db:migrate:up` | Apply migrations |
| `pnpm --filter=@pitchkit/api db:migrate:create` | Create a migration |
| `pnpm generate` | Regenerate OpenAPI client / types |
| `pnpm lint` / `pnpm fmt` | Lint and format |
| `pnpm test` | Run tests |
| `pnpm build` | Build all packages and apps |

Mobile (Capacitor): after a SPA build, see [CAPACITOR.md](apps/web-spa/CAPACITOR.md).

## Project structure

```
apps/
  api/             NestJS API + MikroORM + Better Auth
  web-spa/         React authenticated app (+ Capacitor)
  web-ssr/         React public site
  documentation/   Starlight docs
packages/
  ui/              Shared UI (shadcn / Radix)
  i18n/            Shared i18n
  openapi-generator/  Typed API client from OpenAPI
```

## Documentation

### Product

- [PitchKit product overview](apps/documentation/src/content/docs/explanations/pitchkit-product.mdx) — domain model and features
- [Production runbook](apps/documentation/src/content/docs/guides/pitchkit-production.mdx) — staging, Dokploy, secrets, soft launch
- [Full docs index](apps/documentation/INDEX.md)

### Apps

- [API README](apps/api/README.md)
- [Web SPA README](apps/web-spa/README.md)
- [Web SSR README](apps/web-ssr/README.md)
- [Capacitor / mobile](apps/web-spa/CAPACITOR.md)
- [Documentation app README](apps/documentation/README.md)

### Engineering guidelines

- [General guidelines](apps/documentation/src/content/docs/references/general.mdx)
- [Backend guidelines](apps/documentation/src/content/docs/references/backend.mdx)
- [Frontend guidelines](apps/documentation/src/content/docs/references/frontend.mdx)
- [Architecture](apps/documentation/src/content/docs/explanations/1_architecture.mdx)
- [Auth](apps/documentation/src/content/docs/core-features/1_auth.mdx)
- [Database migrations](apps/documentation/src/content/docs/explanations/6_database-migrations.mdx)
- [Email](apps/documentation/src/content/docs/core-features/5_email.mdx)
- [Monitoring (Sentry)](apps/documentation/src/content/docs/core-features/2_monitoring.mdx)
- [Generating OpenAPI types](apps/documentation/src/content/docs/guides/generating-types.mdx)
- [API testing](apps/documentation/src/content/docs/guides/api-testing.mdx)
- [Release and versioning](apps/documentation/src/content/docs/references/1_release_and_versionning.mdx)
- [Contributing](CONTRIBUTING.md)

Browse all pages locally with `pnpm docs-only`.

## Local Docker services

Defined in `docker-compose.yml`:

- **PostgreSQL** — primary database
- **MailDev** — local SMTP + web UI (development only)

## Deployment

Images are built and pushed to GHCR by CI; environments are promoted via Dokploy. Follow the [production runbook](apps/documentation/src/content/docs/guides/pitchkit-production.mdx) and [release and versioning](apps/documentation/src/content/docs/references/1_release_and_versionning.mdx).

Workflow notes: [`.github/ACTIONS.md`](.github/ACTIONS.md).
