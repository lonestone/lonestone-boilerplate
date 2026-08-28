---
id: unreleased/api-prefix-env
domain: api
classification: migration
pr: 149
requires:
  - unreleased/openapi-generator-docs-url
---

# Expose the Nest global prefix as API_PREFIX

## Goal

The Nest global prefix lives in `API_PREFIX`. Nest reads it at boot. The OpenAPI generator keeps `API_URL` as a host origin and joins `${API_URL}${API_PREFIX}/docs.json` when it fetches the spec.

## Why

Pull request 147 put `/api` inside the generator's `API_URL` so `${API_URL}/docs.json` hit the right path. That left the generator as the only env whose "API URL" was not an origin. Concatenating the prefix again at `pnpm rock` time repeats that shape and does not make the prefix easier to change. `API_PREFIX` is the shared value. The generator composes the docs URL when it runs. Rock only copies the two keys.

## Applies When

- The project tracks the `api` domain, or `apps/api/` exists.
- `apps/api/src/main.ts` still has `const PREFIX = '/api'`, or `API_PREFIX` is missing, or `packages/openapi-generator/.env` `API_URL` still ends with `/api`. Still having any of those is the starting state this intention migrates away from, not a skip reason.

## Do Not Apply When

- The project has no `apps/api/` app — record as skipped.
- The API already uses a custom prefix mechanism that is not Nest `setGlobalPrefix` — stop and ask rather than rewriting env keys.
- A human has explicitly decided to keep the prefix baked into the generator `API_URL` after reviewing this intention — record as skipped with that reason.

## Observable Gaps

1. **API env key** — signal: `apps/api/.env.example` (or `.env`) has no `API_PREFIX`.
   Add `API_PREFIX=/api` next to `API_PORT` / `API_BASE_URL`, matching the staged reference `apps/api/.env.example`. Do not put the prefix into `API_BASE_URL`.
   Done when: `API_PREFIX=/api` is present in `apps/api/.env.example`.

2. **Env schema** — signal: `apps/api/src/config/env.config.ts` has no `API_PREFIX` field, or `config.api` has no `prefix`.
   Add `API_PREFIX` with default `/api`, normalize leading/trailing slashes, and expose `config.api.prefix`, matching the staged reference. Do not rename `API_BASE_URL`.
   Done when: `config.api.prefix` is set from `API_PREFIX`.

3. **Nest bootstrap** — signal: `apps/api/src/main.ts` contains `const PREFIX = '/api'`.
   Read `config.api.prefix` instead. Leave Scalar, CORS, and the json-parser middleware as they are besides the prefix source.
   Done when: `rg "const PREFIX = '/api'" apps/api/src/main.ts` returns nothing.

4. **Generator env** — signal: `packages/openapi-generator/.env.example` has `API_URL=http://localhost:<port>/api`, or it has no `API_PREFIX`.
   Set `API_URL` to the host origin and add `API_PREFIX=/api`, matching the staged reference. Do not change frontend `VITE_API_URL`.
   Done when: generator `API_URL` has no trailing `/api` and `API_PREFIX` is present.

5. **Generator fetch** — signal: `packages/openapi-generator/preprocess/index.js` fetches `${process.env.API_URL}/docs.json`, or `package.json` `dev` waits on `${API_URL}/docs.json`.
   Fetch and wait on `${API_URL}${API_PREFIX}/docs.json` via `buildOpenApiDocsUrl`, matching the staged references. Do not concatenate the prefix in `cli/setup.ts`.
   Done when: preprocess calls `buildOpenApiDocsUrl`, and `cli/setup.ts` writes generator `API_URL` as the origin plus a separate `API_PREFIX`.

6. **Generator docs** — signal: `apps/documentation/src/content/docs/guides/generating-types.mdx` still says generator `API_URL` includes `/api`.
   Adapt the short URL note from the staged reference. Do not rewrite the rest of that page.
   Done when: generating-types states that the generator fetches `${API_URL}${API_PREFIX}/docs.json`.

## Out of Scope

- Frontend `VITE_API_URL` and the generated client `baseURL`.
- Better Auth `basePath` (still the library default `/api/auth`).
- Changing the default prefix away from `/api`.
- Regenerating `packages/openapi-generator/client/` or `tmp/openapi.json`.

## Reference Paths

- `apps/api/.env.example` — **copy**
- `apps/api/src/config/env.config.ts` — **adapt**
- `apps/api/src/main.ts` — **adapt**
- `packages/openapi-generator/.env.example` — **copy**
- `packages/openapi-generator/preprocess/docs-url.js` — **copy**
- `packages/openapi-generator/preprocess/index.js` — **adapt**
- `packages/openapi-generator/package.json` — **adapt**
- `cli/setup.ts` — **adapt**
- `cli/utils.ts` — **adapt**
- `apps/documentation/src/content/docs/guides/generating-types.mdx` — **adapt**

## Validation

- `apps/api/.env.example` contains `API_PREFIX=/api`.
- `packages/openapi-generator/.env.example` `API_URL` is the host origin and `API_PREFIX=/api`.
- `pnpm --filter=api typecheck` passes.
- With the API running, `pnpm generate` fetches `${API_URL}${API_PREFIX}/docs.json`.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/api-prefix-env --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
