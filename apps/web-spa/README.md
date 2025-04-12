# SPA (Single Page Application)

This application is a SPA (Single Page Application) built with React and Vite.

## Environment Variables

### Environment Variables Management in a SPA

In a SPA, environment variables must be defined at build time as they are integrated into the JavaScript bundle. This means you cannot simply change these variables after the build without rebuilding the application.

### Available Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `VITE_API_URL` | Backend API URL | Yes | - |

> **Note**: All environment variables used in the application must start with `VITE_` to be accessible in the client code.

## Building with Docker

### Building the Image

```bash
# At the project root
docker build -t lonestone/web-spa \
  --build-arg VITE_API_URL=https://api.example.com \
  -f apps/web-spa/Dockerfile .
```

### Running the Container

```bash
docker run -p 80:80 lonestone/web-spa
```

### Runtime Variable Replacement

If you need to replace certain environment variables without rebuilding the image, you can use the runtime replacement mechanism:

```bash
docker run -p 80:80 \
  -e VITE_API_URL=https://api-staging.example.com \
  lonestone/web-spa
```

> **Important**: This mechanism works by searching for placeholders like `%VITE_API_URL%` in JavaScript files and replacing them with the provided values. For this to work, your code must use these placeholders.

Example usage in code:

```typescript
// Direct usage (will be replaced at runtime)
const apiUrl = '%VITE_API_URL%'

// Or with a default value
const apiUrl = '%VITE_API_URL%' || 'https://api.default.com'
```

## Local Development

For local development:

```bash
# At the project root
pnpm install
pnpm --filter web-spa dev
```

You can set local environment variables by creating a `.env.local` file in the `apps/web-spa` directory:

```
VITE_API_URL=http://localhost:3000
```

## Overview

This is the web frontend application of our project, built with modern React and a robust set of tools for an optimal development experience.

## Tech Stack

- [React 19](https://react.dev/) - A JavaScript library for building user interfaces
- [TypeScript](https://www.typescriptlang.org/) - JavaScript with syntax for types
- [Tailwind CSS](https://tailwindcss.com/) - A utility-first CSS framework
- [Shadcn UI](https://ui.shadcn.com/) - Re-usable components built with Radix UI and Tailwind CSS
- [React Router v7](https://reactrouter.com/) - Declarative routing for React
- [TanStack Query](https://tanstack.com/query/latest) - Powerful asynchronous state management
- [TanStack Table](https://tanstack.com/table/latest) - Headless UI for building powerful tables
- [TanStack Form](https://tanstack.com/form/latest) - Powerful and type-safe form builder
- [Better Auth](https://github.com/better-auth-io/better-auth) - Authentication and authorization solution

## Prerequisites

Before you begin, ensure you have installed:
- [Node.js](https://nodejs.org/) (v18 or higher)
- [pnpm](https://pnpm.io/) (v8 or higher)

## Getting Started

1. Install dependencies:
```bash
pnpm install
```

2. Start the development server:
```bash
pnpm dev
```

The application will be available at `http://localhost:5173`

## Available Scripts

- `pnpm dev` - Start the development server
- `pnpm build` - Build the application for production
- `pnpm preview` - Preview the production build locally

## Project Structure

```
src/
├── components/     # Reusable UI components
├── features/       # Feature-specific components and logic
├── hooks/         # Custom React hooks
├── lib/           # Utility functions and configurations
```
