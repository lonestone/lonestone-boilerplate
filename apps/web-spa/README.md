# Application SPA (Single Page Application)

Cette application est une SPA (Single Page Application) construite avec React et Vite.

## Variables d'environnement

### Gestion des variables d'environnement dans une SPA

Dans une SPA, les variables d'environnement doivent être définies au moment du build car elles sont intégrées dans le bundle JavaScript. Cela signifie que vous ne pouvez pas simplement changer ces variables après le build sans reconstruire l'application.

### Variables d'environnement disponibles

| Variable | Description | Obligatoire | Défaut |
|----------|-------------|-------------|--------|
| `VITE_API_URL` | URL de l'API backend | Oui | - |

> **Note**: Toutes les variables d'environnement utilisées dans l'application doivent commencer par `VITE_` pour être accessibles dans le code client.

## Construction avec Docker

### Construction de l'image

```bash
# À la racine du projet
docker build -t lonestone/web-spa \
  --build-arg VITE_API_URL=https://api.example.com \
  -f apps/web-spa/Dockerfile .
```

### Exécution du conteneur

```bash
docker run -p 80:80 lonestone/web-spa
```

### Remplacement des variables au runtime

Si vous avez besoin de remplacer certaines variables d'environnement sans reconstruire l'image, vous pouvez utiliser le mécanisme de remplacement au runtime :

```bash
docker run -p 80:80 \
  -e VITE_API_URL=https://api-staging.example.com \
  lonestone/web-spa
```

> **Important**: Ce mécanisme fonctionne en recherchant des placeholders comme `%VITE_API_URL%` dans les fichiers JavaScript et en les remplaçant par les valeurs fournies. Pour que cela fonctionne, votre code doit utiliser ces placeholders.

Exemple d'utilisation dans le code :

```typescript
// Utilisation directe (sera remplacé au runtime)
const apiUrl = '%VITE_API_URL%'

// Ou avec une valeur par défaut
const apiUrl = '%VITE_API_URL%' || 'https://api.default.com'
```

## Développement local

Pour le développement local :

```bash
# À la racine du projet
pnpm install
pnpm --filter web-spa dev
```

Vous pouvez définir les variables d'environnement locales en créant un fichier `.env.local` dans le répertoire `apps/web-spa` :

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
