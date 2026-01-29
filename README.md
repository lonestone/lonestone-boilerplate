<p align="center">
  <img src="./assets/logo-preview.webp" alt="Lonestone Logo" width="200">
</p>

# Boilerplate project

This repository represents the typical project structure at Lonestone, consisting of an API and one to several frontends.

To start a new project using this boilerplate, simply create a project on Github and select the boilerplate from the template list.

For more details, see the [documentation](https://lonestone.github.io/lonestone-boilerplate/) or check out the local documentation in the `apps/documentation` folder.

[![CI ✨](https://github.com/lonestone/lonestone-boilerplate/actions/workflows/ci.yml/badge.svg)](https://github.com/lonestone/lonestone-boilerplate/actions/workflows/ci.yml)
[![Deploy documentation to GitHub Pages](https://github.com/lonestone/lonestone-boilerplate/actions/workflows/deploy-docs.yml/badge.svg)](https://github.com/lonestone/lonestone-boilerplate/actions/workflows/deploy-docs.yml)

## 📋 Table of Contents

- [Overview](#-overview)
- [Tech Stack](#️-tech-stack)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Docker Services](#-docker-services)
- [Useful Commands](#️-useful-commands)
- [Development](#-development)
- [Continuous Integration (CI)](#-continuous-integration-ci)
- [Documentation](#-documentation)
- [Deployment](#-deployment)

## 🔍 Overview

This project uses a "monorepo" architecture. The advantages are numerous, but primarily:

- Ability to develop full-stack features without context switching, making a single PR for a complete feature;
- Easier deployment: no need to synchronize multiple separate deployments;
- Strong end-to-end typing, easier refactoring;
- Simplified and unified tooling (linter, build, etc.)

## 🛠️ Tech Stack

See the [Architecture](apps/documentation/src/content/docs/explanations/architecture.mdx) page for more details.

## 📁 Project Structure

See the [Project Structure](apps/documentation/src/content/docs/explanations/architecture.mdx) page for more details.

## 📋 Prerequisites

- [Node.js](https://nodejs.org/) (version 24.13.0)
- [PNPM](https://pnpm.io/) (version 10.28.2)
- [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/)

## 🚀 Installation

1. Once your project is created with this template, clone the repository

```bash
git clone https://github.com/lonestone/yourproject.git
cd yourproject
```

2. Ensure you have the correct node and pnpm versions (see root `package.json` file's `engines` property).

You can use [fnm](https://github.com/Schniz/fnm) for managing your node version

```bash
fnm use 24.13.0
npm i -g pnpm@10.28.2
```

3. Install dependencies:

```bash
pnpm install
```

4. Run the setup script

The project includes an automated setup script that will:
- Detect available applications (API, Web SPA, Web SSR, OpenAPI Generator)
- Prompt you for database configuration (user, password, name, host, port)
- Prompt you for application ports
- Configure SMTP settings (MailDev)
- Copy and configure all `.env` files automatically
- Optionally start Docker services (database, MailDev)
- Optionally run database migrations

```bash
pnpm rock
```

The script will guide you through the configuration process interactively. It will:
- Ask for your project name
- Update package.json files for detected applications with the project name
- Check for existing `.env` files and only prompt for missing variables
- Automatically update all `.env` files with your configuration
- Set up proper API URLs and trusted origins across all applications

5. Start applications in development mode:

```bash
pnpm dev
```

### Manual Setup (Alternative)

If you prefer to configure everything manually:

1. Copy environment files:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web-spa/.env.example apps/web-spa/.env
cp apps/web-ssr/.env.example apps/web-ssr/.env
cp packages/openapi-generator/.env.example packages/openapi-generator/.env
```

⚠️ In most of those `.env` files, the API url and port are used. Remember to update all the files to match your API url and port.

2. Start Docker services:

```bash
pnpm docker:up
```

3. Run migrations or set up your schema by following the instructions in the [API README](apps/api/README.md).

## 🐳 Docker Services

The project uses Docker Compose to provide the following services:

- PostgreSQL - Database server
- MailDev - SMTP server for development (not to be used in production!)
- MinIO - S3 compatible storage solution (not to be used in production!)

## ⌨️ Useful Commands

### Docker

- **Start Docker services**: `pnpm docker:up`
- **Stop Docker services**: `pnpm docker:down`
- **View Docker logs**: `pnpm docker:logs`

### Development

- **Start development** (all apps except mobile): `pnpm dev`
- **Start mobile development**: `pnpm dev:mobile`
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
- The mobile app is built with React Native and Expo. See the [Mobile README](apps/mobile/README.md) for more information.

You can start each application in development mode with the following commands:

```bash
# Start API in development mode from root folder
pnpm --filter=api dev
```

```bash
# Start mobile app in development mode
pnpm dev:mobile
# or from its own folder
cd apps/mobile && pnpm dev
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

## 🔍 Tracing Architecture

The project uses a unified OpenTelemetry tracing architecture that integrates both Sentry and Langfuse:

- **Shared TracerProvider**: A single OpenTelemetry TracerProvider manages traces for both Sentry (application monitoring) and Langfuse (AI/LLM tracing)
- **Distributed Tracing**: Traces are automatically propagated across services, allowing you to see the full request flow
- **AI Tracing**: All AI/LLM calls are automatically traced in Langfuse with full prompt visibility, token usage, and latency metrics
- **Application Tracing**: All application spans (controllers, services, database queries) are traced in Sentry for performance monitoring and error tracking

The tracing system is initialized in `apps/api/src/instrument.ts` and automatically started when the API server boots. See the [AI module documentation](apps/api/src/modules/ai/README.md) and [tracing documentation](apps/documentation/src/content/docs/addons/tracing-sentry.mdx) for more details.

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

### Deployment with Docker Compose

An example Docker Compose configuration is available in the `docker-compose.yml` file at the project root.
