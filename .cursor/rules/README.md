# Cursor Rules

Ce dossier contient les règles Cursor pour le projet Lonestone. Ces règles sont utilisées par l'IA de Cursor pour comprendre les conventions et les bonnes pratiques du projet.

## Règles disponibles

- **front.mdc**: Règles pour le développement frontend (React, TypeScript, Tailwind, etc.)
- **api.mdc**: Règles pour le développement backend (NestJS, TypeScript, MikroORM, etc.)

## Comment utiliser les règles

Les règles sont automatiquement attachées aux conversations lorsque vous ouvrez un fichier qui correspond au glob pattern défini dans la règle. Vous pouvez également les référencer explicitement dans vos conversations avec l'IA.

### Exemple d'utilisation

```
Cursor, j'ai besoin d'aide pour créer un nouveau module d'API pour la gestion des utilisateurs. Peux-tu me guider en suivant les règles de notre API?
```

## Comment ajouter ou modifier des règles

1. Créez un nouveau fichier `.mdc` dans ce dossier
2. Ajoutez un titre à la première ligne
3. Ajoutez le contenu de la règle
4. Vous pouvez référencer des fichiers de documentation avec la syntaxe `[nom](mdc:chemin/vers/fichier.md)`

## Structure d'une règle

```
Titre de la règle
# Contenu de la règle

- Point 1
- Point 2
- Référence à la documentation: [nom](mdc:chemin/vers/fichier.md)
```
