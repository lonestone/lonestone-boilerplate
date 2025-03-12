# GitHub Workflows

Ce dossier contient les workflows GitHub Actions pour le projet Lonestone.

## Workflows disponibles

### CI (Continuous Integration)

Le workflow CI (`workflows/ci.yml`) est exécuté à chaque push sur les branches `main` et `master`, ainsi que sur les pull requests vers ces branches.

Il comprend les jobs suivants:

#### Lint

- Vérifie le code avec ESLint pour s'assurer qu'il respecte les conventions de codage.
- Commande: `pnpm lint`

#### Type Check

- Vérifie les types TypeScript pour tous les packages et applications.
- Génère d'abord les clients OpenAPI avec `pnpm generate`.
- Exécute ensuite la vérification des types pour chaque package et application.

#### Build

- Construit tous les packages et applications.
- Génère d'abord les clients OpenAPI avec `pnpm generate`.
- Exécute ensuite `pnpm build` pour construire tous les packages et applications.
- Archive les artefacts de build pour une utilisation ultérieure.

## Configuration

Le workflow utilise:
- Node.js 18
- pnpm 8
- Cache pour les dépendances pnpm
- Actions officielles pour le checkout, setup Node.js, setup pnpm, etc.

## Ajout d'un nouveau workflow

Pour ajouter un nouveau workflow:

1. Créez un nouveau fichier `.yml` dans le dossier `workflows/`.
2. Définissez les événements qui déclenchent le workflow (push, pull_request, etc.).
3. Définissez les jobs et les étapes du workflow.
4. Commitez et pushez le fichier.

## Ressources

- [Documentation GitHub Actions](https://docs.github.com/en/actions)
- [Marketplace GitHub Actions](https://github.com/marketplace?type=actions) 