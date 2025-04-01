<p align="center">
  <img src="./assets/logo-preview.webp" alt="Lonestone Logo" width="200">
</p>

# Boilerplate project

This repository represents the typical project structure at Lonestone, consisting of an API and multiple frontends.

To start a new project using this boilerplate, simply create a project on Github and select the boilerplate from the template list.

## 📋 Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Docker Services](#docker-services)
- [Useful Commands](#useful-commands)
- [Development](#development)
- [Continuous Integration (CI)](#continuous-integration-ci)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

## 🔍 Overview

This project uses a "monorepo" architecture. The advantages are numerous, but primarily:

- Ability to develop full-stack features without context switching, making a single PR for a complete feature;
- Easier deployment: no need to synchronize multiple separate deployments;
- Strong end-to-end typing, easier refactoring;
- Simplified and unified tooling (linter, build, etc.)

## 🛠️ Tech Stack

### Frontend

- [React 19](https://react.dev/) - JavaScript library for building user interfaces
- [TypeScript](https://www.typescriptlang.org/) - JavaScript with syntax for types
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [Shadcn UI](https://ui.shadcn.com/) - Reusable components built with Radix UI and Tailwind CSS
- [React Router v7](https://reactrouter.com/) - Declarative routing for React
- [TanStack Query](https://tanstack.com/query/latest) - Powerful asynchronous state management
- [React Hook Form](https://react-hook-form.com/) - React form management

### Backend

- [NestJS](https://nestjs.com/) - Progressive Node.js framework
- [TypeScript](https://www.typescriptlang.org/) - JavaScript with syntax for types
- [MikroORM](https://mikro-orm.io/) - TypeScript ORM for Node.js
- [Zod](https://zod.dev/) - TypeScript-first schema validation
- [Better Auth](https://www.better-auth.com/docs) - Authentication and authorization solution

### Infrastructure

- [Docker](https://www.docker.com/) - Containerization platform
- [PostgreSQL](https://www.postgresql.org/) - Relational database management system
- [MinIO](https://min.io/) - S3-compatible object storage

## 📁 Project Structure

```
lonestone/
├── apps/                  # Main applications
│   ├── api/               # Backend API (NestJS)
│   ├── web-spa/           # Web SPA application (React)
│   └── web-ssr/           # Web SSR application (React)
├── packages/              # Shared packages
│   ├── ui/                # Reusable UI components (shadcn/ui)
│   ├── validations/       # Shared validation schemas
│   ├── openapi-generator/ # OpenAPI client generator
│   └── eslint-config/    # Shared ESLint configuration
├── docs/                  # Project documentation
└── .github/              # GitHub Actions workflows
```

## 📋 Prerequisites

- [Node.js](https://nodejs.org/) (version 22.14.0)
- [PNPM](https://pnpm.io/) (version 10.5.0)
- [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/)

## 🚀 Installation

1. Once your project is created with this template, clone the repository

```bash
git clone https://github.com/lonestone/yourproject.git
cd yourproject
```

2. Ensure you have the correct node and pnpm versions (see root `package.json` file's  `engine` property).

You can use [fnm](https://github.com/Schniz/fnm) for managing your node version

```bash
fnm use 22.14.0
npm i -g pnpm@10.5.0
```

3. Install dependencies:

```bash
pnpm install
```

4. Configure environment variables

We use a single `.env` file at the project root for all applications.
This eliminates the need to configure each application individually.

```bash
cp .env.test .env
```

5. Start Docker services:

```bash
pnpm docker:up db
```

6. If migrations are in place

Drop the DB and perform database migrations without seeding:

```bash
pnpm with-env --filter=api db:migrate:fresh # Drop the database and migrate up to the latest version
```

Or migration + seed

```bash
pnpm with-env --filter=api db:migrate:seed # Same but run seeders afterwards
```

7. During development, or if migrations are not yet in place

Reset your db

```bash
pnpm with-env --filter=api db:fresh # Drop the database and re-create from your entity files
```

Reset + seed

```bash
pnpm with-env --filter=api db:seed # Same but run seeders afterwards
```

8. Start applications in development mode:

```bash
pnpm dev
```

## 🐳 Docker Services

The project uses Docker Compose to provide the following services:

- PostgreSQL
- MinIO, a S3 compatible storage solution (not to be used in production!)

## ⌨️ Useful Commands

### Docker

- **Start Docker services**: `pnpm docker:up`
- **Stop Docker services**: `pnpm docker:down`
- **View Docker logs**: `pnpm docker:logs`

### Development

- **Start development**: `pnpm dev`
- **Build applications**: `pnpm build`
- **Lint applications**: `pnpm lint`
- **Generate OpenAPI clients**: `pnpm with-env generate`

### Database (API)

- **Create migration**: `pnpm with-env --filter=api db:migration:create`
- **Run migrations**: `pnpm with-env --filter=api db:migrate:up`
- **Rollback last migration**: `pnpm with-env --filter=api db:migrate:down`
- **Initialize data**: `pnpm with-env --filter=api db:seed`

### Tests

- **Run tests**: `pnpm with-env test`

## 💻 Development

### Applications

#### API (NestJS)

The backend API is built with NestJS and provides server functionality for the Lonestone application.

```bash
# Start API in development mode
pnpm --filter=api dev
```

For more information, see the [API README](apps/api/README.md).

#### Web SPA (React)

The SPA web application is built with React and provides the user interface for the Lonestone application.

```bash
# Start web application in development mode
pnpm --filter=web-spa dev
```

#### Web SSR (React)

The SSR web application is built with React and provides a server-side rendered version of the user interface.

```bash
# Start SSR web application in development mode
pnpm --filter=web-ssr dev
```

For more information, see the [Web Application README](apps/web-ssr/README.md).

### Shared Packages

#### UI

Reusable UI components built with shadcn/ui.

#### Validations

Validation schemas shared between frontend and backend.

#### OpenAPI Generator

OpenAPI client generator for frontend-backend communication.

#### ESLint Config

Shared ESLint configuration to maintain code consistency across the monorepo.

## 🔄 Continuous Integration (CI)

The project uses GitHub Actions for continuous integration. Workflows are defined in the `.github/workflows/` folder.

### CI Workflow

The CI workflow (`ci.yml`) runs on every push to the `main` and `master` branches, as well as on pull requests to these branches.

It includes the following jobs:

- **Lint**: Checks code with ESLint
- **Type Check**: Checks TypeScript types for all packages and applications
- **Build**: Builds all packages and applications

For more information, see the [GitHub Workflows README](.github/README.md).

## 📚 Documentation

Project documentation is available in the `docs/` folder and in app `README`s. It contains information about architecture, coding conventions, and development guides.

- [Frontend Guidelines](docs/frontend-guidelines.md)
- [Backend Guidelines](docs/backend-guidelines.md)
- [API Readme](apps/api/README.md)

# Lonestone Foundation

This monorepo contains several applications that can be built and deployed independently with Docker.

## Project Structure

- `apps/api`: Backend API (NestJS)
- `apps/web-spa`: Frontend SPA application (React/Vite)
- `apps/web-ssr`: Frontend SSR application
- `packages/`: Packages shared between applications

## Building with Docker

### Prerequisites

- Docker installed on your machine
- Node.js and pnpm for local development

### Building Docker Images

#### Backend API

```bash
# At project root
docker build -t lonestone/api -f apps/api/Dockerfile .
```

Environment variables for API (to be defined in your deployment environment):

- `DATABASE_PASSWORD`: Database password
- `DATABASE_USER`: Database user
- `DATABASE_NAME`: Database name
- `DATABASE_HOST`: Database host
- `DATABASE_PORT`: Database port
- `BETTER_AUTH_SECRET`: Secret key for JWTs
- `API_PORT`: Port the API listens on (default: 3000)

#### SPA (Single Page Application)

```bash
# At project root
docker build -t lonestone/web-spa \
  --build-arg VITE_API_URL=https://api.example.com \
  -f apps/web-spa/Dockerfile .
```

Environment variables for SPA (to be defined at build time):

- `VITE_API_URL`: Backend API URL

#### SSR (Server-Side Rendering) Application

```bash
# At project root
docker build -t lonestone/web-ssr -f apps/web-ssr/Dockerfile .
```

Environment variables for SSR application (to be defined in your deployment environment):

- `API_URL`: Backend API URL
- `PORT`: Port the SSR application listens on (default: 3000)

### Running Containers

#### Backend API

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

#### SPA Application

```bash
docker run -p 80:80 lonestone/web-spa
```

To override environment variables at runtime (if needed):

```bash
docker run -p 80:80 \
  -e VITE_API_URL=https://api-staging.example.com \
  lonestone/web-spa
```

#### SSR Application

```bash
docker run -p 3000:3000 \
  -e API_URL=https://api.example.com \
  lonestone/web-ssr
```

## Local Development

For local development, use pnpm:

```bash
# Install dependencies
pnpm install

# Start API in development mode
pnpm --filter api dev

# Start SPA in development mode
pnpm --filter web-spa dev

# Start SSR application in development mode
pnpm --filter web-ssr dev
```

## Deployment with Docker Compose

An example Docker Compose configuration is available in the `docker-compose.yml` file at the project root.
