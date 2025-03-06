# Lonestone Monorepo

Ce dépôt est configuré comme un monorepo utilisant PNPM Workspaces pour gérer plusieurs packages et applications.

## Prérequis

- [Node.js](https://nodejs.org/) (version 18 ou supérieure)
- [PNPM](https://pnpm.io/) (version 8 ou supérieure)
- [Docker](https://www.docker.com/) et [Docker Compose](https://docs.docker.com/compose/)

## Structure du projet

- `apps/` : Contient les applications principales
    - `web/` : React router v7 [https://reactrouter.com/home]
    - `api/` : Nest JS [https://nestjs.com/]
- `packages/` : Contient les packages partagés
    - `ui/` : Composants et librairies UI propulses par shadcn/ui [https://ui.shadcn.com/]

## Installation

1. Clonez le dépôt :

```bash
git clone https://github.com/lonestone/lonestone.git
```

2. Installez les dépendances :

```bash
pnpm install
```

3. Populate les variables d'environnement :

```bash
cp .env.example .env
```

4. Démarrez les services Docker :

```bash
pnpm docker:up
```

5. Effectuez les migrations :

```bash
pnpm --filter=api db:migrate:up
```

6. Seed les données :

```bash
pnpm --filter=api db:seed
```

7. Démarrez les applications :

```bash
pnpm dev
```

## Services Docker

Le projet utilise Docker Compose pour fournir les services suivants :

### PostgreSQL

- **Port** : 5432
- **Utilisateur** : postgres
- **Mot de passe** : postgres
- **Base de données** : lonestone

Pour se connecter à PostgreSQL :

```bash
psql -h localhost -U postgres -d lonestone
```

### MinIO (S3 compatible storage)

- **API Port** : 9000
- **Console Port** : 9001
- **Access Key** : minio
- **Secret Key** : minio123
- **Console URL** : http://localhost:9001

## Commandes utiles

- **Démarrer les services Docker** : `pnpm docker:up`
- **Arrêter les services Docker** : `pnpm docker:down`
- **Voir les logs Docker** : `pnpm docker:logs`
- **Démarrer le développement** : `pnpm dev`
- **Construire les applications** : `pnpm build`
- **Linter les applications** : `pnpm lint`



