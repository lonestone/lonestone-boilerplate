---
id: unreleased/zod-client-drop-default-format-regex
domain: frontend
classification: migration
---

# Drop the redundant regexes from the generated Zod client

## Goal

The generated `zod.gen.ts` writes `z.uuid()`, `z.email()` or `z.iso.datetime()` without a `.regex()` that repeats the format's own check, and writes each remaining regex once as a shared constant.

## Why

Zod's `toJSONSchema` writes a `pattern` next to every `format` (https://github.com/colinhacks/zod/issues/4120). The Hey API Zod plugin turns the format into `z.uuid()` and then adds `.regex(pattern)` on top, so the same check runs twice and the long regex is copied on every field. The API keeps publishing the pattern, which is valid JSON Schema, so the fix lives in the client generator: a string resolver in `openapi-ts.config.ts` drops the regex when it equals the pattern the installed Zod emits for that format, and keeps every other pattern.

## Applies When

- `packages/openapi-generator/openapi-ts.config.ts` exists and uses the `zod` plugin.
- `rg -F '.regex(/' packages/openapi-generator/client/zod.gen.ts` finds `z.uuid().regex(`, `z.email().regex(` or `z.iso.datetime().regex(`.

## Do Not Apply When

- The project pins `@hey-api/openapi-ts` to a version whose Zod plugin has no `~resolvers` option.

## Observable Gaps

1. **String resolver** — signal: `rg "zodDefaultPattern" packages/openapi-generator/openapi-ts.config.ts` finds nothing.
   Copy the types, `zodDefaultPattern`, `patternSymbols`, `patternSymbol` and `zodString` from the staged `packages/openapi-generator/openapi-ts.config.ts`, and set the zod plugin's `'~resolvers'` to `{ string: zodString }`. If the project has its own string resolver, merge its branch into `zodString` before the `const` step, as the `format: binary` branch is.
   Done when: `rg "zodDefaultPattern" packages/openapi-generator/openapi-ts.config.ts` matches.
2. **Regenerated client** — signal: `rg -F 'z.uuid().regex(' packages/openapi-generator/client/zod.gen.ts` matches.
   Run `pnpm generate` with the API running.
   Done when: that search finds nothing, and every `.regex(` left in `zod.gen.ts` takes a `zPatternN` constant.

## Out of Scope

- The API's OpenAPI document and the backend Zod schemas.
- Any other plugin option in `openapi-ts.config.ts`.

## Reference Paths

- `packages/openapi-generator/openapi-ts.config.ts` — **adapt**

## Validation

- `pnpm typecheck` passes.
- The diff of `zod.gen.ts` only removes `.regex()` calls after `z.uuid()`, `z.email()`, `z.iso.date()`, `z.iso.datetime()`, `z.iso.time()`, `z.ipv4()` or `z.ipv6()`, and moves the other regexes into constants.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/zod-client-drop-default-format-regex --applied` after validation passes, or record it as skipped with a reason.
