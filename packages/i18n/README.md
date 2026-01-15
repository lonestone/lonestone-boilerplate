# `@boilerstone/i18n`

Shared internationalization (i18n) package for the monorepo.

It includes:
- `i18next` initialization for React (`react-i18next`)
- a centralized configuration for supported locales
- helpers to load “per-namespace” translations from JSON files
- locale selection management on the client (cookie) and on the server (cookie + `Accept-Language`)
- a persisted/synchronized Zustand store to track the current language and drive `i18next`
- a CLI script to check for missing translation keys across languages at the monorepo level

## Public exports

This package exposes multiple entrypoints (see `package.json`):
- `@boilerstone/i18n`: re-exports the main modules
- `@boilerstone/i18n/config`: i18n config (supported locales, default locale, initialization)
- `@boilerstone/i18n/instance`: `i18next` instance
- `@boilerstone/i18n/store`: Zustand store bound to the `i18next` instance
- `@boilerstone/i18n/utils`: “modules -> resources” conversion helpers (for `import.meta.glob`)
- `@boilerstone/i18n/cookies`: cookie helpers + locale resolution (client + server)

## Translation file convention

The code relies on a JSON file naming convention:

- each “namespace” is a file
- expected format: `<namespace>.locales.<lang>.json`
  - ex: `common.locales.fr.json`
  - ex: `auth.locales.en.json`

Then the i18next “resources” look like:

- `resources[locale][namespace] = {...keys...}`

## Scripts

- `pnpm --filter @boilerstone/i18n check-translations`
  - Runs `src/i18n-sync.ts` and reports missing translation keys across all detected languages (using English as source of truth).


## Tools 

- `src/i18n-config.ts`
  - Declares supported locales (`SUPPORTED_LOCALES`) and their metadata (name, flag, default locale).
  - Centralizes `DEFAULT_LOCALE` / `FALLBACK_LOCALE`.
  - Provides `getLocaleConfig(locale)` to fetch a locale config (with a generic fallback).
  - Provides `initializeI18n(i18n, resources)`: initializes `i18next` + `react-i18next` with common options (namespaces, separators, interpolation). If it fails, falls back to a minimal init.

- `src/i18n-instance.ts`
  - Exports the global `i18next` instance (default export) to share the same singleton across apps/packages.

- `src/i18n-store.ts`
  - Exposes `createI18nStore(i18nInstance)`: a Zustand store that:
    - holds `language`
    - exposes `setLanguage(language)` which calls `i18nInstance.changeLanguage(...)`
    - persists/syncs state via `persist-and-sync` (key `name: 'i18n'`)

- `src/i18n-utils.ts`
  - Helpers to convert dynamic imports (e.g. `import.meta.glob`) into an i18next `Resource`:
    - extracts the `namespace` from the path
    - extracts the locale from the `.locales.<lang>.json` suffix
    - groups by locale and converts to `resources`
  - Main functions:
    - `extractAvailableLocales(modules)`
    - `groupModulesByLocale(modules)`
    - `modulesToResources(groupedModules)`
    - `loadDynamicLocales(allModules)`

- `src/i18n-cookies.ts`
  - Cookie helpers and locale resolution:
    - generic cookie header parsing (`parseCookies`)
    - reads/validates locale from cookies (`getLocaleFromCookies`)
    - infers locale from `Accept-Language` (`getDefaultLocaleFromAcceptLanguage`)
  - Client-side (browser):
    - `setCookie`, `getCookie`, `removeCookie`
    - `setLocaleCookie`, `getLocaleCookie`, `removeLocaleCookie`
    - `getInitialLocale()`: cookie → browser language → default
  - Server-side:
    - `getLocaleFromRequestWithFallback(request)`: cookie → `Accept-Language` → default

- `src/i18n-sync.ts`
  - Node (CLI) script that scans the monorepo for `locales` directories and reports missing translation keys:
    - English (`en`) is the source of truth
    - for each namespace, lists keys present in English but missing in other languages
    - generates TypeScript types for i18next
    - does not modify translation files (i18next fallback handles missing keys at runtime)
  - Runnable via `tsx` (see `check-translations` script).