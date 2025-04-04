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
- Use kebab-case for file names.
- Use features folder to add route components or scoped components. Look at other features in the repo. It shoud look like this:
    - features/
        - common/ for common files, hooks, etc.
            - hooks/
            - utils/
            - atoms/
        - featureName/
            - components/
                - feature-component.tsx
                - another-component.tsx
            - hooks/ for hooks scoped to this feature
            - utils/ for utils scoped to this feature
- Use app folder to had global components that are used in multiple features.
- Use utils folder to had utility functions.
- Use components from @lonestone/ui in ./packages/ui.
- Check types, schemas and sdk from @lonestone/openapi-generator in ./packages/openapi-generator.
    - ./packages/openapi-generator/client/sdk.gen.ts
    - ./packages/openapi-generator/client/schemas.gen.ts
    - ./packages/openapi-generator/client/zod.gen.ts
    - ./packages/openapi-generator/client/types.gen.ts
- Use shadcn/ui for components.
- Use react-router for routing.
    - routes are usually defined in a `routes.ts` file
- Use tanstack-query for data fetching
    - structure queries by features, put the queries options in /features/featureName/utils/featureName-queries.ts
```
export function fetchOrganizationQueryOptions(options: { pageSize: number, page: number, search?: string }) {
  return {
    queryKey: ['organizations', options.page, options.pageSize, options.search],
    queryFn: () =>
      apiClient.organizationsControllerFindAll({
        query: {
          offset: (options.page - 1) * options.pageSize,
          pageSize: options.pageSize,
          filter: options.search ? `name:like:${options.search}` : undefined,
        },
      }),
  }
}

// in component
  const { data: organizations } = useQuery({
    ...fetchOrganizationQueryOptions({ page: pageValue, search: searchValue, pageSize: PAGE_SIZE }),
  })
```
- Use react-hook-form for form handling.
- Use zod for form validation.
