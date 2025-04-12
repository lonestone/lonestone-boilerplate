# Email Module

This module handles email sending in the application.

## Technologies Used

- [nodemailer](https://nodemailer.com/about/) - Email sending service

## Features

- Email sending service
- Support for transactional emails
- Email logging

## Configuration

Currently, the module is configured to log emails rather than actually sending them. This is useful for development and testing.

## Sending Interface

```typescript
interface EmailOptions {
  to: string
  subject: string
  content: string
}
