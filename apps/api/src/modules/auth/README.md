# Authentication Module

This module handles user authentication and authorization in the application.

NestJS integration is provided by [`@thallesp/nestjs-better-auth`](https://github.com/ThallesP/nestjs-better-auth). Local code keeps the MikroORM adapter, entity codegen, Better Auth config, and a thin `AuthModule` wrapper.

Auth HTTP routes are served under `/api/auth` (Better Auth default `basePath`).

## Technologies Used

- [better-auth](https://www.better-auth.com/docs) - Authentication library
- [@thallesp/nestjs-better-auth](https://better-auth.com/docs/integrations/nestjs) - NestJS AuthModule, global AuthGuard, decorators

## Features

- User session management
- User account management
- Email verification system
- Global route protection (`@AllowAnonymous` / `@OptionalAuth` / `@Session`)
- Authentication event hooks (Nest DI `@Hook` / `@BeforeHook` / `@AfterHook`)
- MikroORM `RequestContext` around the Better Auth handler

## Entities

- `User` - User information
- `Session` - Active sessions
- `Account` - User-linked accounts
- `Verification` - Verifications (email, etc.)
