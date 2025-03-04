# Module de configuration

Ce module gère la configuration de l'application à travers les variables d'environnement.

## Technologies utilisées

- [Zod](https://zod.dev/) - Validation des schémas de configuration

## Fonctionnalités

- Validation des variables d'environnement
- Configuration de l'environnement d'exécution
- Configuration de la base de données
- Configuration du port de l'API

## Variables d'environnement gérées

- `NODE_ENV` - Environnement d'exécution (development, test, production)
- `API_PORT` - Port de l'API
- `DATABASE_*` - Configuration de la base de données (host, port, name, user, password) 