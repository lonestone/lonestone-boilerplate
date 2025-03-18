# API Backend

Cette API est construite avec NestJS et sert de backend pour les applications frontend.
[Guidelines API](../docs/api-guidelines.md)

## Variables d'environnement

| Variable | Description | Obligatoire | Défaut |
|----------|-------------|-------------|--------|
| `DATABASE_PORT` | Port de connexion à la base de données | Oui | - |
| `DATABASE_HOST` | Host de connexion à la base de données | Oui | - |
| `DATABASE_USER` | Utilisateur de connexion à la base de données | Oui | - |
| `DATABASE_PASSWORD` | Mot de passe de connexion à la base de données | Oui | - |
| `DATABASE_NAME` | Nom de la base de données | Oui | - |
| `API_PORT` | Port sur lequel l'API écoute | Non | `3000` |
| `BETTER_AUTH_SECRET` | Clé secrète pour les JWT | Oui | - |
| `NODE_ENV` | Environnement (development, production) | Non | `production` |

```env
DATABASE_PORT=5432
DATABASE_HOST=localhost
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=postgres

BETTER_AUTH_SECRET=your_secret_key
API_PORT=3000
NODE_ENV=production
```

## Construction avec Docker

### Construction de l'image

```bash
# À la racine du projet
docker build -t lonestone/api -f apps/api/Dockerfile .
```

### Exécution du conteneur

```bash
docker run -p 3000:3000 \
  -e DATABASE_PASSWORD=password \
  -e DATABASE_USER=user \
  -e DATABASE_NAME=dbname \
  -e DATABASE_HOST=db \
  -e DATABASE_PORT=5432 \
  -e BETTER_AUTH_SECRET=secret \
  -e API_PORT=3000 \
  lonestone/api
```

### Exécution avec migrations (si applicable)

Si vous utilisez des migrations de base de données, vous pouvez les exécuter au démarrage du conteneur en décommentant la ligne appropriée dans le Dockerfile ou en utilisant une commande personnalisée :

```bash
docker run -p 3000:3000 \
  -e DATABASE_PASSWORD=password \
  -e DATABASE_USER=user \
  -e DATABASE_NAME=dbname \
  -e DATABASE_HOST=db \
  -e DATABASE_PORT=5432 \
  -e BETTER_AUTH_SECRET=secret \
  -e API_PORT=3000 \
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
DATABASE_PASSWORD=password
DATABASE_USER=user
DATABASE_NAME=dbname
DATABASE_HOST=localhost
DATABASE_PORT=5432
BETTER_AUTH_SECRET=dev_secret_key
API_PORT=3000
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

## Générer un module

```bash
pnpm generate:module --name=caca
```

To create a new module, you can use the following command:

```bash
pnpm generate:module --name=module-name

```
It's generated with the following files:

- `__name__.controller.ts`
- `__name__.service.ts`
- `__name__.entity.ts`
- `__name__.module.ts`
- `contracts/__name__.contract.ts`
- `tests/__name__.controller.spec.ts`


## Stack

Parmis les plus importantes :
- [NestJS](https://github.com/nestjs/nest) en tant que framework backend ;
- [MikroORM](https://mikro-orm.io/) en tant qu'ORM ;
- [better-auth](https://www.better-auth.com/docs) en tant que module d'authentification ;
- [Zod](https://zod.dev/) pour la validation des données en entrée et en sortie de l'API ;
- [ESLint](https://eslint.org/) pour formater le code et mettre en place différentes règles de syntaxes
- La configuration ESLint de [Antfu](https://github.com/antfu/eslint-config) comme base
- [DotEnv](https://github.com/motdotla/dotenv) pour gérer les fichiers de configuration (.env) quel que soit l'OS