# API Backend

This API is built with NestJS and serves as the backend for frontend applications.
[API Guidelines](../documentation/src/content/docs/guidelines/backend.mdx)

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

## OpenAPI documentation

The API is automatically documented with OpenAPI (if you use the correct decorators and add `openapi()` to your zod schemas).

By default you can access the documentation at `http://localhost:3000/api/docs`.

Better-auth also has a plugin to generate the documentation for you. You can find its specific documentation at `http://localhost:3000/api/auth/reference` by default.

## Database management

Ensure you have read the [Database Migrations](../documentation/src/content/docs/explanations/6_database-migrations.mdx) page to know which flow to use (development vs migrations).

### Resetting the database

Reset your db

```bash
pnpm db:fresh # Drop the database and re-create from your entity files
```

Reset + seed

```bash
pnpm db:seed # Same but run seeders afterwards
```

Drop the DB and perform all database migrations without seeding:

```bash
pnpm db:migrate:fresh # Drop the database and migrate up to the latest version
```

Or migration + seed

```bash
pnpm db:migrate:seed # Same but run seeders afterwards
```

After making changes to your entities, you will need to create and commit a new migration.

```bash
# Generate a migration
pnpm db:migrate:create

# Run migrations
pnpm db:migrate:up

# Rollback last migration
pnpm db:migrate:down
```

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
  lonestone/api sh -c "pnpm db:migrate:up && node dist/main.js"
```
