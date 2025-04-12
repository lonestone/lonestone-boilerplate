# Web Application

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

# SSR (Server-Side Rendering) Application

This application uses server-side rendering (SSR) to improve performance and SEO.

## Environment Variables

Unlike a SPA, an SSR application can use environment variables at runtime because rendering is done on the server side.

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `API_URL` | Backend API URL | Yes | - |
| `PORT` | Port on which the SSR application listens | No | `3000` |
| `NODE_ENV` | Environment (development, production) | No | `production` |

## Building with Docker

### Building the Image

```bash
# At the project root
docker build -t lonestone/web-ssr -f apps/web-ssr/Dockerfile .
```

### Running the Container

```bash
docker run -p 3000:3000 \
  -e API_URL=https://api.example.com \
  -e PORT=3000 \
  -e NODE_ENV=production \
  lonestone/web-ssr
```

## Local Development

For local development:

```bash
# At the project root
pnpm install
pnpm --filter web-ssr dev
```

You can set local environment variables by creating a `.env` file in the `apps/web-ssr` directory:

```
API_URL=http://localhost:3000
PORT=3001
NODE_ENV=development
```

## Differences between SSR and SPA

### Advantages of SSR

- Better SEO as search engines see the complete content
- Faster initial loading time
- Better performance on low-power devices

### Environment Variables Management

Unlike a SPA where environment variables must be defined at build time, an SSR application can use environment variables at runtime, which makes it easier to deploy in different environments without rebuilding the image.
