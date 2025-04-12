# Authentication Module

This module handles user authentication and authorization in the application.

/!\ Warning: The middleware is configured for routes starting with `/auth/*`

## Technologies Used

- [better-auth](https://www.better-auth.com/docs) - Authentication library

## Features

- User session management
- User account management
- Email verification system
- Authentication middleware
- Route protection guards
- Authentication event hooks

## Entities

- `User` - User information
- `Session` - Active sessions
- `Account` - User-linked accounts
- `Verification` - Verifications (email, etc.)
