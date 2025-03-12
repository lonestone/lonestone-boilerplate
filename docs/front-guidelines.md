---
Description: This document contains guidelines for the front-end of the Lonestone project.
Globs: apps/web-ssr/* & apps/web-spa/*
---

# Front-end Guidelines

## Stack

- React
- TypeScript
- Tailwind CSS
- Shadcn UI
- React Router v7
- Tanstack Query
- React Hook Form
- Zod

## General Instructions
- Use components from @lonestone/ui in ./packages/ui.
- Use client and sdk to interact with the backend from @lonestone/openapi-generator in ./packages/openapi-generator.
- Use react-hook-form and zod for form handling and validation.
- Use shadcn/ui for components.
- Use react-router for routing.
- Use tanstack-query for data fetching.
- Use react-hook-form for form handling.
- Use zod for form validation.
- Use kebab-case for file names.
- Use features folder to had route components or scoped components.
- Use app folder to had global components that are used in multiple features.
- Use utils folder to had utility functions.
