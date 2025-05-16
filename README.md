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
- [DotenvX](https://dotenvx.com/) - Environment variables management

## 📁 Project Structure

```
lonestone/
├── apps/                  # Main applications
│   ├── api/               # Backend API (NestJS)
│   ├── web-spa/           # Web SPA application (React)
│   └── web-ssr/           # Web SSR application (React)
├── packages/              # Shared packages
│   ├── ui/                # Reusable UI components (shadcn/ui)
│   ├── openapi-generator/ # OpenAPI client generator
│   └── schematics/        # Schematics used to generate code in API
├── docs/                  # Project documentation
└── .github/               # GitHub Actions workflows
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

The `.env` file at the project's root is used by docker (docker compose).

Each app then has its own `.env` file in its corresponding subfolder.

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web-spa/.env.example apps/web-spa/.env
cp apps/web-ssr/.env.example apps/web-ssr/.env
cp packages/openapi-generator/.env.example packages/openapi-generator/.env
```

⚠️ In most of those `.env` files, the API url and port are used. Remember to update all the files to match your API url and port.

5. Start Docker services:

```bash
pnpm docker:up db
```

6. Run migrations or set up your schema by following the instructions in the [API README](apps/api/README.md).

7. Start applications in development mode:

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
- **Generate OpenAPI clients**: `pnpm generate`

### Database (API)

- **Create migration**: `pnpm db:migrate:create`
- **Run migrations**: `pnpm db:migrate:up`
- **Rollback last migration**: `pnpm db:migrate:down`
- **Initialize data**: `pnpm db:seed`

### Tests

- **Run tests**: `pnpm test`

## 💻 Development

### Applications

- The API is built with NestJS and provides a REST API. See the [API README](apps/api/README.md) for more information.
- The web-spa is built with React and provides a single-page application. See the [Web SPA README](apps/web-spa/README.md) for more information.
- The web-ssr is built with React and provides a server-side rendered application. See the [Web SSR README](apps/web-ssr/README.md) for more information.

You can start each application in development mode with the following commands:

```bash
# Start API in development mode from root folder
pnpm --filter=api dev
```

```bash
# Start API from its own folder
cd apps/api && pnpm dev
```

### Shared Packages

- UI -> Reusable UI components built with shadcn/ui.
- OpenAPI Generator -> contains the generator plus the generated types, validators and sdk for frontend-backend communication. Imported by the frontend apps.

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

This documentation is also used by our custom cursor rules.

- [Frontend Guidelines](docs/frontend-guidelines.md)
- [Backend Guidelines](docs/backend-guidelines.md)
- [API Readme](apps/api/README.md)

## 🚀 Deployment

It's your choice to decide how you want to deploy the applications, your main options being:

- Use a PaaS cloud service like Render or Dokploy which will build and host your services
- Build the applications, via Docker, and publish their image on a registry to be used by Render or other PaaS
- Use docker-compose (not recommended).

### Building with Docker

#### Prerequisites

- Docker installed on your machine
- Node.js and pnpm for local development

See the dedicated README files for more details on how to build and run Docker images.

## Deployment with Docker Compose

An example Docker Compose configuration is available in the `docker-compose.yml` file at the project root.
