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

# Application SSR (Server-Side Rendering)

Cette application utilise le rendu côté serveur (SSR) pour améliorer les performances et le SEO.

## Variables d'environnement

Contrairement à une SPA, une application SSR peut utiliser des variables d'environnement au runtime, car le rendu se fait côté serveur.

| Variable | Description | Obligatoire | Défaut |
|----------|-------------|-------------|--------|
| `API_URL` | URL de l'API backend | Oui | - |
| `PORT` | Port sur lequel l'application SSR écoute | Non | `3000` |
| `NODE_ENV` | Environnement (development, production) | Non | `production` |

## Construction avec Docker

### Construction de l'image

```bash
# À la racine du projet
docker build -t lonestone/web-ssr -f apps/web-ssr/Dockerfile .
```

### Exécution du conteneur

```bash
docker run -p 3000:3000 \
  -e API_URL=https://api.example.com \
  lonestone/web-ssr
```

## Développement local

Pour le développement local :

```bash
# À la racine du projet
pnpm install
pnpm --filter web-ssr dev
```

Vous pouvez définir les variables d'environnement locales en créant un fichier `.env` dans le répertoire `apps/web-ssr` :

```
API_URL=http://localhost:3000
PORT=3001
NODE_ENV=development
```

## Différences entre SSR et SPA

### Avantages du SSR

- Meilleur SEO car les moteurs de recherche voient le contenu complet
- Temps de chargement initial plus rapide
- Meilleure performance sur les appareils à faible puissance

### Gestion des variables d'environnement

Contrairement à une SPA où les variables d'environnement doivent être définies au moment du build, une application SSR peut utiliser des variables d'environnement au runtime, ce qui facilite le déploiement dans différents environnements sans reconstruire l'image.