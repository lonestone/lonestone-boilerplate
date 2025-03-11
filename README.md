# Lonestone Monorepo

![Lonestone Logo](https://placeholder-for-lonestone-logo.com/logo.png)

Ce dépôt est configuré comme un monorepo utilisant PNPM Workspaces pour gérer plusieurs packages et applications. Il contient le code source du projet Lonestone, une solution complète et moderne.

## 📋 Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Stack technique](#stack-technique)
- [Structure du projet](#structure-du-projet)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Services Docker](#services-docker)
- [Commandes utiles](#commandes-utiles)
- [Développement](#développement)
- [Intégration Continue (CI)](#intégration-continue-ci)
- [Documentation](#documentation)
- [Contribution](#contribution)
- [Licence](#licence)

## 🔍 Vue d'ensemble

Lonestone est une application moderne construite avec une architecture monorepo. Cette approche nous permet de partager du code entre différentes applications tout en maintenant une séparation claire des préoccupations.

## 🛠️ Stack technique

### Frontend
- [React 19](https://react.dev/) - Bibliothèque JavaScript pour construire des interfaces utilisateur
- [TypeScript](https://www.typescriptlang.org/) - JavaScript avec une syntaxe pour les types
- [Tailwind CSS](https://tailwindcss.com/) - Framework CSS utilitaire
- [Shadcn UI](https://ui.shadcn.com/) - Composants réutilisables construits avec Radix UI et Tailwind CSS
- [React Router v7](https://reactrouter.com/) - Routage déclaratif pour React
- [TanStack Query](https://tanstack.com/query/latest) - Gestion d'état asynchrone puissante
- [React Hook Form](https://react-hook-form.com/) - Gestion de formulaires React

### Backend
- [NestJS](https://nestjs.com/) - Framework Node.js progressif
- [TypeScript](https://www.typescriptlang.org/) - JavaScript avec une syntaxe pour les types
- [MikroORM](https://mikro-orm.io/) - ORM TypeScript pour Node.js
- [Zod](https://zod.dev/) - Validation de schéma TypeScript-first
- [Better Auth](https://www.better-auth.com/docs) - Solution d'authentification et d'autorisation

### Infrastructure
- [Docker](https://www.docker.com/) - Plateforme de conteneurisation
- [PostgreSQL](https://www.postgresql.org/) - Système de gestion de base de données relationnelle
- [MinIO](https://min.io/) - Stockage d'objets compatible S3

## 📁 Structure du projet

```
lonestone/
├── apps/                  # Applications principales
│   ├── api/               # API backend (NestJS)
│   ├── web-spa/           # Application web SPA (React)
│   └── web-ssr/           # Application web SSR (React)
├── packages/              # Packages partagés
│   ├── ui/                # Composants UI réutilisables (shadcn/ui)
│   ├── validations/       # Schémas de validation partagés
│   ├── openapi-generator/ # Générateur de clients OpenAPI
│   └── eslint-config/     # Configuration ESLint partagée
├── docs/                  # Documentation du projet
└── .github/               # Workflows GitHub Actions
```

## 📋 Prérequis

- [Node.js](https://nodejs.org/) (version 18 ou supérieure)
- [PNPM](https://pnpm.io/) (version 8 ou supérieure)
- [Docker](https://www.docker.com/) et [Docker Compose](https://docs.docker.com/compose/)

## 🚀 Installation

1. Clonez le dépôt :

```bash
git clone https://github.com/lonestone/lonestone.git
cd lonestone
```

2. Installez les dépendances :

```bash
pnpm install
```

3. Configurez les variables d'environnement :

```bash
cp .env.example .env
```

4. Démarrez les services Docker :

```bash
pnpm docker:up
```

5. Effectuez les migrations de la base de données :

```bash
pnpm --filter=api db:migrate:up
```

6. Initialisez les données de test :

```bash
pnpm --filter=api db:seed
```

7. Démarrez les applications en mode développement :

```bash
pnpm dev
```

## 🐳 Services Docker

Le projet utilise Docker Compose pour fournir les services suivants :
 - PostgreSQL
 - MinIO

## ⌨️ Commandes utiles

### Docker
- **Démarrer les services Docker** : `pnpm docker:up`
- **Arrêter les services Docker** : `pnpm docker:down`
- **Voir les logs Docker** : `pnpm docker:logs`

### Développement
- **Démarrer le développement** : `pnpm dev`
- **Construire les applications** : `pnpm build`
- **Linter les applications** : `pnpm lint`
- **Générer les clients OpenAPI** : `pnpm generate`

### Base de données (API)
- **Créer une migration** : `pnpm --filter=api db:migration:create`
- **Exécuter les migrations** : `pnpm --filter=api db:migrate:up`
- **Annuler la dernière migration** : `pnpm --filter=api db:migrate:down`
- **Initialiser les données** : `pnpm --filter=api db:seed`

## 💻 Développement

### Applications

#### API (NestJS)
L'API backend est construite avec NestJS et fournit les fonctionnalités serveur pour l'application Lonestone.

```bash
# Démarrer l'API en mode développement
pnpm --filter=api dev
```

Pour plus d'informations, consultez le [README de l'API](apps/api/README.md).

#### Web SPA (React)
L'application web SPA est construite avec React et fournit l'interface utilisateur pour l'application Lonestone.

```bash
# Démarrer l'application web en mode développement
pnpm --filter=web-spa dev
```

#### Web SSR (React)
L'application web SSR est construite avec React et fournit une version rendue côté serveur de l'interface utilisateur.

```bash
# Démarrer l'application web SSR en mode développement
pnpm --filter=web-ssr dev
```

Pour plus d'informations, consultez le [README de l'application web](apps/web-ssr/README.md).

### Packages partagés

#### UI
Composants UI réutilisables construits avec shadcn/ui.

#### Validations
Schémas de validation partagés entre le frontend et le backend.

#### OpenAPI Generator
Générateur de clients OpenAPI pour la communication entre le frontend et le backend.

#### ESLint Config
Configuration ESLint partagée pour maintenir la cohérence du code dans tout le monorepo.

## 🔄 Intégration Continue (CI)

Le projet utilise GitHub Actions pour l'intégration continue. Les workflows sont définis dans le dossier `.github/workflows/`.

### Workflow CI

Le workflow CI (`ci.yml`) est exécuté à chaque push sur les branches `main` et `master`, ainsi que sur les pull requests vers ces branches.

Il comprend les jobs suivants:

- **Lint** : Vérifie le code avec ESLint
- **Type Check** : Vérifie les types TypeScript pour tous les packages et applications
- **Build** : Construit tous les packages et applications

Pour plus d'informations, consultez le [README des workflows GitHub](.github/README.md).

## 📚 Documentation

La documentation du projet est disponible dans le dossier `docs/`. Elle contient des informations sur l'architecture, les conventions de codage et les guides de développement.

- [Guidelines Frontend](docs/frontend-guidelines.md)
- [Guidelines Backend](docs/backend-guidelines.md)

## 👥 Contribution

Les contributions sont les bienvenues ! Veuillez suivre ces étapes pour contribuer :

1. Créez une branche pour votre fonctionnalité (`git checkout -b feature/amazing-feature`)
2. Committez vos changements (`git commit -m 'Add some amazing feature'`)
3. Poussez vers la branche (`git push origin feature/amazing-feature`)
4. Ouvrez une Pull Request




