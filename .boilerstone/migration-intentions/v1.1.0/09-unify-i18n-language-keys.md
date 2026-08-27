---
id: v1.1.0/unify-i18n-language-keys
domain: frontend
classification: migration
---

# Unify i18n Language Keys

## Goal

`@boilerstone/i18n` (and SPA/SSR consumers) identify languages as `en` | `fr`. `htmlLang` carries the BCP-47 tag for `<html lang>`. Legacy `fr-FR` / `en-GB` cookie and localStorage values normalize on read.

## Why

The boilerplate used BCP-47 tags as i18next language keys. That split identity (`fr` vs `fr-FR`) broke cookie/localStorage round-trips and SSR hand-off. Keys are now `en` | `fr`; `SUPPORTED_LOCALES[key].htmlLang` is the document language. Callers that still pass `defaultLocale` or BCP-47 into `setLanguage` / i18next drift from the tested package.

## Applies When

- The project tracks the `frontend` domain and uses `@boilerstone/i18n` (or an in-tree copy of `packages/i18n`).
- Language identity is still BCP-47 (`fr-FR`, `en-GB`), or code still exports/uses `defaultLocale` with i18next instead of language keys plus `htmlLang`.

## Do Not Apply When

- The project has no i18n package and no frontend localization.
- A human has explicitly decided to keep BCP-47 as i18next keys after reviewing this intention — record as skipped with that reason. Still using `fr-FR` keys is **not** a skip condition.

## Observable Gaps

1. **Locale table** — signal: `packages/i18n/src/i18n-config.ts` (or equivalent) keys locales as `fr-FR` / `en-GB`, or has no `htmlLang` field.
   Adapt the staged reference: `SUPPORTED_LOCALES` keyed by `en` | `fr`, each with `htmlLang`. Keep project-specific extra locales if they already exist, but give them language keys plus `htmlLang`.
   Done when: `SUPPORTED_LOCALE_KEYS` is language-only and `getHtmlLang` exists.

2. **Normalize on read** — signal: cookie or localStorage readers reject or persist BCP-47 values without mapping them to a language key.
   Adapt staged `packages/i18n/src/i18n-cookies.ts` and `packages/i18n/src/i18n-store.ts`: `normalizeLocale` / `matchSupportedLocale` accept `fr-FR` and store `fr`.
   Done when: reading a legacy cookie value yields `fr` or `en`.

3. **i18next init** — signal: `initializeI18n` still uses BCP-47 `lng` / `supportedLngs`, or `load` is not `languageOnly`.
   Adapt staged `i18n-config.ts` (`load: 'languageOnly'`, `supportedLngs` = language keys). Do not rewrite translation JSON filenames unless they still use BCP-47 in the path.
   Done when: `pnpm --filter=@boilerstone/i18n test` (or the project's equivalent) passes.

4. **App callers** — signal: SPA/SSR still pass `fr-FR` into `setLanguage` or set `<html lang>` from the i18next key instead of `getHtmlLang`.
   Adapt staged SPA/SSR i18n wiring (`apps/web-spa/app/lib/i18n/i18n-client.ts`, `apps/web-spa/app/root.tsx`). Leave feature copy alone.
   Done when: document language is a BCP-47 `htmlLang` and i18next `lng` is a language key.

## Out of Scope

- Adding new languages or rewriting translation strings.
- React Router 8 `loaderData` — `unreleased/migrate-react-router-8`.
- Server-side cookie negotiation beyond the shared helpers.

## Reference Paths

- `packages/i18n/src/i18n-config.ts` — **adapt**
- `packages/i18n/src/i18n-cookies.ts` — **adapt**
- `packages/i18n/src/i18n-store.ts` — **adapt**
- `packages/i18n/src/i18n-sync.ts` — **adapt**
- `packages/i18n/README.md` — **adapt**
- `apps/web-spa/app/lib/i18n/i18n-client.ts` — **adapt**
- `apps/web-spa/app/root.tsx` — **adapt**

## Validation

- `pnpm --filter=@boilerstone/i18n test` passes when that package has tests.
- `pnpm --filter=@boilerstone/i18n typecheck` passes.
- A stored `fr-FR` cookie/localStorage value reads back as `fr`.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/unify-i18n-language-keys --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
