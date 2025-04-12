# API Backend

This API is built with NestJS and serves as the backend for frontend applications.
[API Guidelines](../docs/api-guidelines.md)

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_PORT` | Database connection port | Yes | - |
| `DATABASE_HOST` | Database connection host | Yes | - |
| `DATABASE_USER` | Database connection user | Yes | - |
| `DATABASE_PASSWORD` | Database connection password | Yes | - |
| `DATABASE_NAME` | Database name | Yes | - |
| `API_PORT` | Port on which the API listens | No | `3000` |
| `BETTER_AUTH_SECRET` | Secret key for JWTs | Yes | - |
| `NODE_ENV` | Environment (development, production) | No | `production` |

```env
DATABASE_PORT=5432
DATABASE_HOST=localhost
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=postgres

BETTER_AUTH_SECRET=your_secret_key
API_PORT=3000
NODE_ENV=production
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
  lonestone/api sh -c "pnpm migration:run && node dist/main.js"
```

## Local Development

For local development:

```bash
# At the project root
pnpm install
pnpm --filter api dev
```

You can set local environment variables by creating a `.env` file in the `apps/api` directory:

```
DATABASE_PASSWORD=password
DATABASE_USER=user
DATABASE_NAME=dbname
DATABASE_HOST=localhost
DATABASE_PORT=5432
BETTER_AUTH_SECRET=dev_secret_key
API_PORT=3000
NODE_ENV=development
```

## Architecture

The API is organized into modules following NestJS's modular architecture:

### Modules
- [Auth](./src/modules/auth/README.md)
- [Config](./src/modules/config/README.md)
- [Db](./src/modules/db/README.md)
- [Email](./src/modules/email/README.md)

## Installation

```bash
pnpm install
```

## Configuration

Create a `.env` file at the project root with the following variables:

```env
NODE_ENV=development
API_PORT=3000

DATABASE_PASSWORD=your_password
DATABASE_USER=your_user
DATABASE_NAME=your_db
DATABASE_HOST=localhost
DATABASE_PORT=5432
```

## Getting Started

```bash
# Development
pnpm run dev

# Production
pnpm run build
node dist/main.js
```

## Database

```bash
# Generate a migration
pnpm run migration:create

# Run migrations
pnpm run migration:up

# Rollback last migration
pnpm run migration:down
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

## Stack

Among the most important:
- [NestJS](https://github.com/nestjs/nest) as the backend framework
- [MikroORM](https://mikro-orm.io/) as the ORM
- [better-auth](https://www.better-auth.com/docs) as the authentication module
- [Zod](https://zod.dev/) for input and output API data validation
- [ESLint](https://eslint.org/) for code formatting and implementing various syntax rules
- [Antfu](https://github.com/antfu/eslint-config)'s ESLint configuration as a base
- [DotEnv](https://github.com/motdotla/dotenv) to manage configuration files (.env) regardless of OS
