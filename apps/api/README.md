# API Lonestone

Cette API est construite avec NestJS et fournit les fonctionnalités backend pour l'application Lonestone.

## Architecture

L'API est organisée en modules suivant l'architecture modulaire de NestJS :

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

Créez un fichier `.env` à la racine du projet avec les variables suivantes :

```env
NODE_ENV=development
API_PORT=3000

DATABASE_PASSWORD=your_password
DATABASE_USER=your_user
DATABASE_NAME=your_db
DATABASE_HOST=localhost
DATABASE_PORT=5432
```

## Démarrage

```bash
# Développement
pnpm run dev

# Production
pnpm run build
node dist/main.js
```

## Base de données

```bash
# Générer une migration
pnpm run migration:create

# Exécuter les migrations
pnpm run migration:up

# Annuler la dernière migration
pnpm run migration:down
```

## Stack

Parmis les plus importantes :
- [NestJS](https://github.com/nestjs/nest) en tant que framework backend ;
- [MikroORM](https://mikro-orm.io/) en tant qu'ORM ;
- [better-auth](https://www.better-auth.com/docs) en tant que module d'authentification ;
- [Zod](https://zod.dev/) pour la validation des données en entrée et en sortie de l'API ;
- [ESLint](https://eslint.org/) pour formater le code et mettre en place différentes règles de syntaxes
- La configuration ESLint de [Antfu](https://github.com/antfu/eslint-config) comme base
- [DotEnv](https://github.com/motdotla/dotenv) pour gérer les fichiers de configuration (.env) quel que soit l'OS