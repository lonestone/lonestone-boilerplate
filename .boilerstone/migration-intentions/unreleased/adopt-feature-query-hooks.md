---
id: unreleased/adopt-feature-query-hooks
domain: frontend
classification: migration
pr: 179
---

# Write API queries as one hook file per feature

## Goal

Each feature that reads or writes the API through TanStack Query has one file, `hooks/use-<feature>.ts`. That file owns the key factory and one hook per query and per mutation. Components call the hooks. They do not call the generated SDK, and they do not write a query key.

## Why

The example apps wrote the same queries three ways: inline in a page, as hooks in a `utils` file, and as an options object in the frontend guidelines that matched no code. Projects copied whichever shape they opened last, so keys and invalidation drifted.

The generated SDK is already the API layer. A second queries file between the SDK and the hooks only repeats it. The hook file is the one place that knows the keys. The component keeps the screen: toast, navigation, form state.

A global `throwOnError` was rejected. It would change every loader that still reads `response.error`, and it does not narrow the type of `data`. `throwOnError: true` is passed on each SDK call inside a hook. The hey-api TanStack Query plugin was rejected because no project uses it. A generic optimistic-update helper was rejected because most screens do not need one.

Returning the invalidation promise from the mutation hook is deliberate. `isPending` stays true until the refetch finishes, so a toast or a navigation that runs in the caller's `onSuccess` happens after the cache is fresh. On the post edit page, the success toast therefore shows after the post and the list have been invalidated.

## Applies When

- The project tracks the `frontend` domain.
- A web app uses TanStack Query together with the generated SDK (`@boilerstone/openapi-generator`, or the project's renamed scope).

## Do Not Apply When

- The project has no web app, or it does not use TanStack Query. Record as skipped.
- A human has explicitly decided to keep another query layout after reviewing this intention. Record as skipped with that reason. Inline `useQuery`, a `utils/*-queries.ts` file, or a missing `throwOnError` is **not** a skip condition.

## Observable Gaps

Work through each feature that talks to the API. Copy the shape of the staged references. Keep the project's own endpoints, params, and copy. Search `apps/web-spa` and `apps/web-ssr` when those apps exist, otherwise the project's web app directories.

1. **Hook file** — signal: `rg -g '!**/hooks/**' "useQuery\\(|useMutation\\(|useInfiniteQuery\\(" <web-apps>` matches a feature component, or a file `features/**/utils/*-queries.ts` exists.
   Add `features/<feature>/hooks/use-<feature>.ts` (kebab-case). Put a key factory and one hook per query and per mutation in it. Point the component at the hook. Delete the queries file when nothing imports it.
   A route loader may still call the SDK. Better Auth (`authClient`) stays where it is.
   Done when: feature components import hooks, and the `rg` above matches no feature component.

2. **Keys** — signal: a `queryKey: [` written outside the feature's hook file, or two files that spell the same array.
   Keys live only on the factory, broad to specific: `all`, `lists()`, `list(params)`, `details()`, `detail(id)`. Every value the `queryFn` reads is part of the key. Another feature imports the factory to invalidate. It does not retype the array.
   Done when: `rg -g '!**/hooks/**' "queryKey: \\[" <web-apps>` matches no feature component.

3. **Errors** — signal: `if (response.error)`, `if (res.error)`, or an SDK call inside a `queryFn` or `mutationFn` without `throwOnError: true`.
   Pass `throwOnError: true` on that call. Do not call `client.setConfig({ throwOnError: true })`.
   Done when: those `if (*.error)` throws are gone from feature hooks, and each SDK call in a `queryFn` or `mutationFn` sets `throwOnError: true`.

4. **Mutations** — signal: a hook imports the `queryClient` singleton (`@/lib/query-client`), or a hook file contains `toast.`, `navigate(`, or `console.error`.
   The mutation hook calls `useQueryClient()`. Its `onSuccess` returns the `invalidateQueries` promise (the detail and the list prefix, or the infinite-query prefix). Toast, navigation, and `console.error` move to the component, on `mutate(variables, { onSuccess, onError })`. Use `mutateAsync` only when the component must wait before the next step, as the comment form does.
   Done when: no feature hook imports the singleton, and no hook file contains `toast.`, `navigate(`, or `console.error`.

## Out of Scope

- Route loaders that call the SDK and do not use TanStack Query.
- Better Auth client calls.
- Pulling `queryOptions` out of a hook before a second caller (a loader or `prefetchQuery`) needs the same query.
- Optimistic updates. Add them in the one mutation that needs them.
- The hey-api TanStack Query plugin, and a global `throwOnError`.
- Generated SDK files.

## Reference Paths

- `apps/web-spa/app/features/examples/user-posts/hooks/use-user-posts.ts` — **adapt**
- `apps/web-spa/app/features/examples/user-posts/user-post-edit-page.tsx` — **adapt**
- `apps/web-ssr/app/features/comments/hooks/use-comments.ts` — **adapt**
- `apps/web-ssr/app/features/comments/comments-list.tsx` — **adapt**

## Validation

- `pnpm typecheck` passes.
- The four signals in Observable Gaps no longer match feature components or feature hooks.
- Editing a post shows the success toast after the post and the list have been invalidated. The comment form stays pending until the comment list has refreshed.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/adopt-feature-query-hooks --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
