# API Backend

Cette API est construite avec NestJS et sert de backend pour les applications frontend.

## Variables d'environnement

| Variable | Description | Obligatoire | Défaut |
|----------|-------------|-------------|--------|
| `DATABASE_PORT` | Port de connexion à la base de données | Oui | - |
| `DATABASE_HOST` | Host de connexion à la base de données | Oui | - |
| `DATABASE_USER` | Utilisateur de connexion à la base de données | Oui | - |
| `DATABASE_PASSWORD` | Mot de passe de connexion à la base de données | Oui | - |
| `DATABASE_NAME` | Nom de la base de données | Oui | - |
| `JWT_SECRET` | Clé secrète pour les JWT | Oui | - |
| `API_PORT` | Port sur lequel l'API écoute | Non | `3000` |
| `TRUSTED_ORIGINS` | Origines approuvées pour les CORS | Non | - |
| `NODE_ENV` | Environnement (development, production) | Non | `production` |

## Construction avec Docker

### Construction de l'image

```bash
# À la racine du projet
docker build -t lonestone/api -f apps/api/Dockerfile .
```

### Exécution du conteneur

```bash
docker run -p 3000:3000 \
  -e DATABASE_URL=postgres://user:password@db:5432/dbname \
  -e JWT_SECRET=your_secret_key \
  lonestone/api
```

### Exécution avec migrations (si applicable)

Si vous utilisez des migrations de base de données, vous pouvez les exécuter au démarrage du conteneur en décommentant la ligne appropriée dans le Dockerfile ou en utilisant une commande personnalisée :

```bash
docker run -p 3000:3000 \
  -e DATABASE_URL=postgres://user:password@db:5432/dbname \
  -e JWT_SECRET=your_secret_key \
  lonestone/api sh -c "pnpm migration:run && node dist/main.js"
```

## Développement local

Pour le développement local :

```bash
# À la racine du projet
pnpm install
pnpm --filter api dev
```

Vous pouvez définir les variables d'environnement locales en créant un fichier `.env` dans le répertoire `apps/api` :

```
DATABASE_URL=postgres://user:password@localhost:5432/dbname
JWT_SECRET=dev_secret_key
PORT=3000
NODE_ENV=development
```

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