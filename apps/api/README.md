# API Backend

This API is built with NestJS and serves as the backend for frontend applications.
[API Guidelines](../docs/api-guidelines.md)

## Architecture

The API is organized into modules following NestJS's modular architecture:

### Modules
- [Auth](./src/modules/auth/README.md)
- [Config](./src/modules/config/README.md)
- [Db](./src/modules/db/README.md)
- [Email](./src/modules/email/README.md)

## Stack

Among the most important:
- [NestJS](https://github.com/nestjs/nest) as the backend framework
- [MikroORM](https://mikro-orm.io/) as the ORM
- [better-auth](https://www.better-auth.com/docs) as the authentication module
- [Zod](https://zod.dev/) for input and output API data validation
- [ESLint](https://eslint.org/) for code formatting and implementing various syntax rules
- [Antfu](https://github.com/antfu/eslint-config)'s ESLint configuration as a base
- [DotEnv](https://github.com/motdotla/dotenv) to manage configuration files (.env) regardless of OS

## Installation

```bash
pnpm install
```

## Configuration

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_PORT` | Database connection port | Yes | - |
| `DATABASE_HOST` | Database connection host | Yes | - |
| `DATABASE_USER` | Database connection user | Yes | - |
| `DATABASE_PASSWORD` | Database connection password | Yes | - |
| `DATABASE_NAME` | Database name | Yes | - |
| `API_PORT` | Port on which the API listens | Yes | - |
| `BETTER_AUTH_SECRET` | Secret key for JWTs | Yes | - |
| `NODE_ENV` | Environment (development, production) | No | `development` |
| `TRUSTED_ORIGINS` | List of trusted origins. ⚠️ If you change the port of your frontends, you need to update this variable. | Yes | - |

See [`apps/api/.env.example`](/apps/api/.env.example) for reference.

## Getting Started

```bash
# Copy basic env
cp .env.example .env

# Run the API in development
pnpm run dev

# Run the API in production
pnpm run build
node dist/main.js
```

## Database

### Migrations flow

There are 2 cases:

1. You are still in development, and no data exists in production. At this point, you do not need to handle migrations yet (but you can if you want).

2. Some data exists in production (or staging), that you need to keep between deployments. At this point, you need to handle migrations.

1. No data exists in production

Reset your db

```bash
pnpm db:fresh # Drop the database and re-create from your entity files
```

Reset + seed

```bash
pnpm db:seed # Same but run seeders afterwards
```

2. Some data exists in production

Drop the DB and perform database migrations without seeding:

```bash
pnpm db:migrate:fresh # Drop the database and migrate up to the latest version
```

Or migration + seed

```bash
pnpm db:migrate:seed # Same but run seeders afterwards
```

After making changes to your entities, you will need to create and commit a new migration.

⚠️ Remember to reset your db state before creating a migration.

```bash
# Generate a migration
pnpm db:migrate:create

# Run migrations
pnpm db:migrate:up

# Rollback last migration
pnpm db:migrate:down
```

## Generate a Module

To create a new module, you can use the following command at root of monorepo:

```bash
pnpm schematics:module --name=module-name
```
It's generated with the following files:

- `__name__.controller.ts`
- `__name__.service.ts`
- `__name__.entity.ts`
- `__name__.module.ts`
- `contracts/__name__.contract.ts`
- `tests/__name__.controller.spec.ts`

## Building with Docker

### Building the Image

```bash
# At the project root
docker build -t lonestone/api -f apps/api/Dockerfile .
```

### Running the Container

```bash
docker run -p 3000:3000 \
  -e DATABASE_PASSWORD=password \
  -e DATABASE_USER=user \
  -e DATABASE_NAME=dbname \
  -e DATABASE_HOST=db \
  -e DATABASE_PORT=5432 \
  -e BETTER_AUTH_SECRET=secret \
  -e API_PORT=3000 \
  lonestone/api
```

### Running with Migrations (if applicable)

If you use database migrations, you can run them when starting the container by uncommenting the appropriate line in the Dockerfile or using a custom command:

```bash
docker run -p 3000:3000 \
  -e DATABASE_PASSWORD=password \
  -e DATABASE_USER=user \
  -e DATABASE_NAME=dbname \
  -e DATABASE_HOST=db \
  -e DATABASE_PORT=5432 \
  -e BETTER_AUTH_SECRET=secret \
  -e API_PORT=3000 \
  lonestone/api sh -c "pnpm migration:run && node dist/main.js"
```
