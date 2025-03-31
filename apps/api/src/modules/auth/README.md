# Module d'authentification

Ce module gère l'authentification et l'autorisation des utilisateurs dans l'application.

/!\ Warning : Le middleware est configuré pour les routes commençant par `/auth/*`

## Technologies utilisées

- [better-auth](https://www.better-auth.com/docs) - Bibliothèque d'authentification

## Fonctionnalités

- Gestion des sessions utilisateurs
- Gestion des comptes utilisateurs
- Système de vérification d'email
- Middleware d'authentification
- Guards pour la protection des routes
- Hooks pour les événements d'authentification

## Entités

- `User` - Informations de l'utilisateur
- `Session` - Sessions actives
- `Account` - Comptes liés aux utilisateurs
- `Verification` - Vérifications (email, etc.)
