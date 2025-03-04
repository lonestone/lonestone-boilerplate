<p align="center">
  <img src="./assets/logo-preview.webp" alt="Lonestone Logo" width="200">
</p>

# Boilerplate project

Ce dépôt est configuré comme un monorepo utilisant PNPM Workspaces pour gérer plusieurs packages et applications. Il contient le code source d'un projet typique de Lonestone, une solution complète et moderne.

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

# Socle Lonestone

Ce monorepo contient plusieurs applications qui peuvent être construites et déployées indépendamment avec Docker.

## Structure du projet

- `apps/api` : API backend (NestJS)
- `apps/web-spa` : Application frontend SPA (React/Vite)
- `apps/web-ssr` : Application frontend SSR
- `packages/` : Packages partagés entre les applications

## Construction avec Docker

### Prérequis

- Docker installé sur votre machine
- Node.js et pnpm pour le développement local

### Construction des images Docker

#### API Backend

```bash
# À la racine du projet
docker build -t lonestone/api -f apps/api/Dockerfile .
```

Variables d'environnement pour l'API (à définir dans votre environnement de déploiement) :

- `DATABASE_URL` : URL de connexion à la base de données
- `JWT_SECRET` : Clé secrète pour les JWT
- `PORT` : Port sur lequel l'API écoute (par défaut: 3000)

#### Application SPA (Single Page Application)

```bash
# À la racine du projet
docker build -t lonestone/web-spa \
  --build-arg VITE_API_URL=https://api.example.com \
  --build-arg VITE_APP_ENV=production \
  --build-arg VITE_APP_VERSION=1.0.0 \
  -f apps/web-spa/Dockerfile .
```

Variables d'environnement pour la SPA (à définir au moment du build) :

- `VITE_API_URL` : URL de l'API backend
- `VITE_APP_ENV` : Environnement (development, staging, production)
- `VITE_APP_VERSION` : Version de l'application

#### Application SSR (Server-Side Rendering)

```bash
# À la racine du projet
docker build -t lonestone/web-ssr -f apps/web-ssr/Dockerfile .
```

Variables d'environnement pour l'application SSR (à définir dans votre environnement de déploiement) :

- `API_URL` : URL de l'API backend
- `PORT` : Port sur lequel l'application SSR écoute (par défaut: 3000)

### Exécution des conteneurs

#### API Backend

```bash
docker run -p 3000:3000 \
  -e DATABASE_URL=postgres://user:password@db:5432/dbname \
  -e JWT_SECRET=your_secret_key \
  lonestone/api
```

#### Application SPA

```bash
docker run -p 80:80 lonestone/web-spa
```

Pour remplacer des variables d'environnement au runtime (si nécessaire) :

```bash
docker run -p 80:80 \
  -e VITE_API_URL=https://api-staging.example.com \
  lonestone/web-spa
```

#### Application SSR

```bash
docker run -p 3000:3000 \
  -e API_URL=https://api.example.com \
  lonestone/web-ssr
```

## Développement local

Pour le développement local, utilisez pnpm :

```bash
# Installation des dépendances
pnpm install

# Démarrage de l'API en mode développement
pnpm --filter api dev

# Démarrage de la SPA en mode développement
pnpm --filter web-spa dev

# Démarrage de l'application SSR en mode développement
pnpm --filter web-ssr dev
```

## Déploiement avec Docker Compose

Un exemple de configuration Docker Compose est disponible dans le fichier `docker-compose.yml` à la racine du projet.
