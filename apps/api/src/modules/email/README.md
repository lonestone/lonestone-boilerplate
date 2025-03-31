# Module d'email

Ce module gère l'envoi d'emails dans l'application.

## Technologies utilisées

- [nodemailer](https://nodemailer.com/about/) - Service d'envoi d'emails

## Fonctionnalités

- Service d'envoi d'emails
- Support pour les emails transactionnels
- Logging des emails envoyés

## Configuration

Actuellement, le module est configuré pour logger les emails plutôt que de les envoyer réellement. Ceci est utile pour le développement et les tests.

## Interface d'envoi

```typescript
interface EmailOptions {
  to: string
  subject: string
  content: string
}
