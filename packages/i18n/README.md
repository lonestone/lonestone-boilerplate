# `@boilerstone/i18n`

Shared internationalization package for SPA and SSR consumers.

## Contract

- **Language identity** is always `en` | `fr` (i18next resources, Zustand store, cookie value).
- **BCP-47 tags** (`en-GB`, `fr-FR`) live only as `htmlLang` metadata for `<html lang>` / `Intl` — never passed to `changeLanguage`.
- **Client persistence**: Zustand + `persist-and-sync` (localStorage).
- **SSR mirror**: `setLanguage` also writes the `locale` cookie so a future SSR loader can resolve language without flash (`cookie` → `Accept-Language` → default).
- **Legacy migration**: BCP-47 cookie/localStorage values (`fr-FR`, `en-GB`) are normalized to `en`|`fr` on read and rewritten at bootstrap.

```
setLanguage(en|fr)
  → i18next.changeLanguage
  → localStorage (persistNSync)
  → cookie locale=en|fr

SSR resolveLocale(request)
  → cookie → Accept-Language → DEFAULT_LOCALE
```

## Public exports

- `@boilerstone/i18n`: re-exports the main modules
- `@boilerstone/i18n/config`: supported locales, defaults, `initializeI18n`, `getHtmlLang`, `normalizeLocale`
- `@boilerstone/i18n/instance`: shared `i18next` singleton
- `@boilerstone/i18n/store`: `createI18nStore(i18n)` (localStorage + cookie mirror)
- `@boilerstone/i18n/utils`: `import.meta.glob` → i18next `Resource` helpers
- `@boilerstone/i18n/cookies`: cookie helpers + server `getLocaleFromRequestWithFallback`

## Translation file convention

- Namespace = filename
- Format: `<namespace>.locales.<lang>.json`
  - `common.locales.fr.json`
  - `auth.locales.en.json`
- Directory layout: `locales/<lang>/...`
- i18next resources: `resources[locale][namespace] = { ...keys }`

## Scripts

- `pnpm --filter @boilerstone/i18n check-translations`
  - Scans monorepo `locales` directories
  - English is the source of truth
  - Exits `1` on missing or orphaned keys
  - Regenerates nearby `i18next.d.ts` type stubs
- `pnpm --filter @boilerstone/i18n test`

## Modules

- `i18n-config.ts` — `SUPPORTED_LOCALES`, `DEFAULT_LOCALE` / `FALLBACK_LOCALE` (`fr`), init
- `i18n-instance.ts` — shared i18next instance
- `i18n-store.ts` — Zustand store; `setLanguage` updates i18n + cookie + localStorage
- `i18n-utils.ts` — glob modules → resources
- `i18n-cookies.ts` — client/server locale cookie helpers (values = `en`|`fr`)
- `i18n-sync.ts` — CLI translation completeness check
