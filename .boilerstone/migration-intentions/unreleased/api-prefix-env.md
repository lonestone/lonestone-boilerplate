---
id: unreleased/api-prefix-env
domain: api
classification: migration
requires:
  - unreleased/openapi-generator-docs-url
---

# Expose the Nest global prefix as API_PREFIX

## Goal

The Nest global prefix lives in `API_PREFIX` on the API env. Nest reads it at boot, and `pnpm rock` appends it when writing the OpenAPI generator `API_URL`.

## Why

Pull request 147 stopped rock from wiping `/api` off the generator URL by hardcoding the string in `cli/setup.ts`. Nest still had its own `const PREFIX = '/api'` in `main.ts`. Changing the prefix meant editing two places that rock could not keep in sync, which is the hole issue 105 asked to close. One env var is the shared source. Frontend `VITE_API_URL` stays at the host origin because generated client paths already include the prefix.

## Applies When

- The project tracks the `api` domain, or `apps/api/` exists.
- `apps/api/src/main.ts` still has `const PREFIX = '/api'`, or `apps/api/.env` / `.env.example` has no `API_PREFIX`, or `cli/setup.ts` writes OpenAPI `API_URL` with a hardcoded `/api`. Still having any of those is the starting state this intention migrates away from, not a skip reason.

## Do Not Apply When

- The project has no `apps/api/` app — record as skipped.
- The API already uses a custom prefix mechanism that is not Nest `setGlobalPrefix` — stop and ask rather than rewriting env keys.
- A human has explicitly decided to keep a hardcoded prefix after reviewing this intention — record as skipped with that reason.

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

4. **rock overwrite** — signal: `cli/setup.ts` writes OpenAPI `API_URL` as `` `http://localhost:${config.ports.api}/api` ``, or it does not write `API_PREFIX` into `apps/api/.env`.
   Read `API_PREFIX` from the API env (or `.env.example`), write it back, and build the generator URL from port plus prefix, matching the staged reference. Leave web-spa and web-ssr `VITE_API_URL` at the host origin.
   Done when: `cli/setup.ts` contains `API_PREFIX` and `buildOpenApiGeneratorApiUrl`, and does not concatenate a hardcoded `/api` onto the generator URL.

5. **Generator docs** — signal: `apps/documentation/src/content/docs/guides/generating-types.mdx` does not mention `API_PREFIX`.
   Adapt the short URL note from the staged reference. Do not rewrite the rest of that page.
   Done when: generating-types states that the generator `API_URL` includes `API_PREFIX`.

## Out of Scope

- Frontend `VITE_API_URL` and the generated client `baseURL`.
- Better Auth `basePath` (still the library default `/api/auth`).
- Changing the default prefix away from `/api`.
- Regenerating `packages/openapi-generator/client/` or `tmp/openapi.json`.

## Reference Paths

- `apps/api/.env.example` — **copy**
- `apps/api/src/config/env.config.ts` — **adapt**
- `apps/api/src/main.ts` — **adapt**
- `cli/setup.ts` — **adapt**
- `cli/utils.ts` — **adapt**
- `apps/documentation/src/content/docs/guides/generating-types.mdx` — **adapt**

## Validation

- `apps/api/.env.example` contains `API_PREFIX=/api`.
- `pnpm --filter=api typecheck` passes.
- After `pnpm rock`, `packages/openapi-generator/.env` `API_URL` equals `http://localhost:<API_PORT><API_PREFIX>`.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/api-prefix-env --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
