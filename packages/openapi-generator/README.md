# OpenAPI Generator

Ce package est utilisé pour générer automatiquement un client TypeScript à partir du schéma OpenAPI fourni par l'API backend NestJS.

## Objectif

L'OpenAPI Generator a plusieurs objectifs clés :

- **Type-safety** : Création automatique de types TypeScript basés sur les endpoints et modèles de données de l'API
- **Cohérence** : Maintien de la synchronisation entre le frontend et le backend
- **Productivité** : Réduction du code boilerplate et des erreurs de typage
- **Documentation** : Fournit une documentation implicite des endpoints disponibles

Le générateur utilise l'outil `@hey-api/openapi-ts` pour transformer la spécification OpenAPI (récupérée depuis l'URL http://localhost:3000/docs-json) en un client TypeScript fortement typé avec validation Zod.

## Usage

Pour générer le client OpenAPI :

```bash
pnpm run generate
```

Pour le développement avec génération automatique quand le schéma change :

```bash
pnpm run dev
```

## Client

Le client est généré dans le répertoire `./src/client` et comprend :

- `sdk.gen.ts` : Fonctions pour appeler les endpoints de l'API
- `types.gen.ts` : Types TypeScript pour les modèles de données
- `zod.gen.ts` : Schémas Zod pour la validation des données
- `schemas.gen.ts` : Définitions détaillées des schémas

## Dépendances

Les packages suivants dépendent d'OpenAPI Generator :

- `apps/web-spa` : Application frontend React en SPA
- `apps/web-ssr` : Application frontend React en SSR
- `packages/ui` : Bibliothèque de composants UI partagés

## Configuration

La configuration se trouve dans le fichier `openapi-ts.config.ts`. Elle définit :

- La source du schéma OpenAPI (endpoint `/docs-json` de l'API NestJS)
- Les formats de sortie et les plugins utilisés
- Les transformations appliquées aux données (ex: conversion des dates)

## Utilisation dans le code

Pour utiliser le client API généré dans une application :

```typescript
import { client } from '@lonestone/openapi-generator'

client.setConfig({
  baseURL: 'http://localhost:3000',
  // autres options...
})
```

```typescript
// Exemple d'utilisation
import { postControllerCreatePost } from '@lonestone/openapi-generator'

const posts = await postControllerCreatePost()
```
