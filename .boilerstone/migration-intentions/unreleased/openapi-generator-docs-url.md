---
id: unreleased/openapi-generator-docs-url
domain: tooling
classification: migration
pr: 147
---

# Point the OpenAPI generator at /api/docs.json

## Goal

The OpenAPI generator waits on and fetches `${API_URL}/docs.json`, and `API_URL` already includes the API global prefix (`http://localhost:<port>/api`). A missing spec fails loudly instead of writing a 404 body to `tmp/openapi.json`.

## Why

Issue 94 already moved the `/api` prefix into `API_URL` and left the fetch path as `/docs.json`. `pnpm rock` then overwrote that env without the prefix, so generate hit `/docs.json` at the host root and saved a Nest 404 JSON. `@hey-api/openapi-ts` reported that as `Unsupported OpenAPI specification`. The `dev` script still waited on Nest swagger's old `/docs-json` path. Hardcoding `/api/docs.json` on top of `API_URL` would double the prefix whenever `.env.example` is used as-is.

## Applies When

- The project tracks the `tooling` domain, or `packages/openapi-generator/` exists.
- `packages/openapi-generator/.env` has an `API_URL` that does not end with `/api`, or the `dev` script still waits on `/docs-json`, or preprocess fetches `${API_URL}/api/docs.json`. Still having any of those is the starting state this intention migrates away from, not a skip reason.

## Do Not Apply When

- The project has no `packages/openapi-generator/` package — record as skipped.
- The API serves the OpenAPI document at a custom path that is not `/api/docs.json` — stop and ask rather than rewriting URLs.
- A human has explicitly decided to keep a different generator URL after reviewing this intention — record as skipped with that reason.

## Observable Gaps

1. **Generator env prefix** — signal: `packages/openapi-generator/.env` (or `.env.example`) has `API_URL=http://localhost:<port>` with no trailing `/api`.
   Set `API_URL` to `http://localhost:<port>/api`, matching the staged reference `packages/openapi-generator/.env.example`. Do not change frontend `VITE_API_URL` values; those stay at the host origin.
   Done when: `API_URL` ends with `/api` and `${API_URL}/docs.json` is `http://localhost:<port>/api/docs.json`.

2. **wait-on path** — signal: `packages/openapi-generator/package.json` `dev` script contains `/docs-json`.
   Change it to `wait-on ${API_URL}/docs.json`. Do not insert an extra `/api` in that path.
   Done when: `rg docs-json packages/openapi-generator/package.json` returns nothing.

3. **preprocess fetch** — signal: `packages/openapi-generator/preprocess/index.js` fetches `${process.env.API_URL}/api/docs.json`, or it calls `res.json()` without checking `res.ok`.
   Keep `${process.env.API_URL}/docs.json` and throw if `!res.ok`, matching the staged reference. Do not add `/api` to the path.
   Done when: the fetch URL is `${process.env.API_URL}/docs.json` and a non-OK response throws before writing `tmp/openapi.json`.

4. **rock overwrite** — signal: `cli/setup.ts` writes OpenAPI `API_URL` as `http://localhost:${config.ports.api}` with no `/api`.
   Append `/api` when writing `packages/openapi-generator/.env`, matching the staged reference. Leave web-spa and web-ssr `VITE_API_URL` without the prefix.
   Done when: the OpenAPI generator branch of `cli/setup.ts` writes a URL ending in `/api`.

5. **Generator docs** — signal: `packages/openapi-generator/README.md` or `apps/documentation/src/content/docs/guides/generating-types.mdx` still mentions `/docs-json`, or they do not say that `API_URL` already includes `/api`.
   Adapt the short URL notes from the staged references. Do not rewrite the rest of those pages.
   Done when: neither file mentions `/docs-json`, and generating-types states that `API_URL` includes the `/api` prefix.

## Out of Scope

- Frontend `VITE_API_URL` and the generated client `baseURL`.
- The API global prefix in `apps/api/src/main.ts`, Scalar setup, and the `/api/docs` UI.
- Regenerating `packages/openapi-generator/client/` or `tmp/openapi.json`.
- Moving the OpenAPI document off `/api/docs.json`.

## Reference Paths

- `packages/openapi-generator/.env.example` — **copy**
- `packages/openapi-generator/package.json` — **adapt**
- `packages/openapi-generator/preprocess/index.js` — **adapt**
- `cli/setup.ts` — **adapt**
- `packages/openapi-generator/README.md` — **adapt**
- `apps/documentation/src/content/docs/guides/generating-types.mdx` — **adapt**

## Validation

- `packages/openapi-generator/.env` `API_URL` ends with `/api`.
- With the API running, `pnpm generate` writes a real OpenAPI document to `tmp/openapi.json` (it contains `openapi`, not a Nest 404 body).
- `rg docs-json packages/openapi-generator` returns nothing in `package.json` or `README.md`.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/openapi-generator-docs-url --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
