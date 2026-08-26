import type { i18n } from 'i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_LOCALE, getHtmlLang, isSupportedLocale, normalizeLocale } from './i18n-config'
import {
  getDefaultLocaleFromAcceptLanguage,
  getLocaleCookie,
  getLocaleFromCookies,
  getLocaleFromRequestWithFallback,
  matchSupportedLocale,
  parseCookies,
  setLocaleCookie,
} from './i18n-cookies'
import { createI18nStore, I18N_STORE_STORAGE_KEY } from './i18n-store'
import { findMissingKeys } from './i18n-sync'
import { extractAvailableLocales, loadDynamicLocales } from './i18n-utils'

describe('normalizeLocale', () => {
  it('keeps supported language keys', () => {
    expect(normalizeLocale('en')).toBe('en')
    expect(normalizeLocale('fr')).toBe('fr')
  })

  it('maps BCP-47 tags to language keys', () => {
    expect(normalizeLocale('fr-FR')).toBe('fr')
    expect(normalizeLocale('en-GB')).toBe('en')
  })

  it('falls back to the default locale', () => {
    expect(normalizeLocale('de')).toBe(DEFAULT_LOCALE)
    expect(normalizeLocale(undefined)).toBe(DEFAULT_LOCALE)
  })
})

describe('getHtmlLang', () => {
  it('returns BCP-47 metadata without changing i18n keys', () => {
    expect(getHtmlLang('fr')).toBe('fr-FR')
    expect(getHtmlLang('en')).toBe('en-GB')
    expect(isSupportedLocale('fr-FR')).toBe(false)
  })
})

describe('cookie helpers', () => {
  it('parses cookies with equals in values', () => {
    expect(parseCookies('locale=fr; token=a=b')).toEqual({
      locale: 'fr',
      token: 'a=b',
    })
  })

  it('accepts SupportedLocale cookie values', () => {
    expect(getLocaleFromCookies('locale=fr')).toMatchObject({
      locale: 'fr',
      isValid: true,
    })
  })

  it('normalizes legacy BCP-47 cookie values', () => {
    expect(getLocaleFromCookies('locale=fr-FR')).toMatchObject({
      locale: 'fr',
      isValid: true,
    })
    expect(getLocaleFromCookies('locale=en-GB')).toMatchObject({
      locale: 'en',
      isValid: true,
    })
  })

  it('matches Accept-Language tags to SupportedLocale keys', () => {
    expect(matchSupportedLocale('fr-FR')).toBe('fr')
    expect(getDefaultLocaleFromAcceptLanguage('en-US,en;q=0.9,fr;q=0.8')).toBe('en')
    expect(getDefaultLocaleFromAcceptLanguage('de-DE,de;q=0.9')).toBeNull()
  })

  it('resolves request locale cookie → Accept-Language → default', () => {
    expect(
      getLocaleFromRequestWithFallback({
        headers: { cookie: 'locale=en', 'accept-language': 'fr-FR' },
      }),
    ).toBe('en')

    expect(
      getLocaleFromRequestWithFallback({
        headers: { cookie: 'locale=fr-FR', 'accept-language': 'en' },
      }),
    ).toBe('fr')

    expect(
      getLocaleFromRequestWithFallback({
        headers: { 'accept-language': 'fr-FR,fr;q=0.9' },
      }),
    ).toBe('fr')

    expect(getLocaleFromRequestWithFallback({ headers: {} })).toBe(DEFAULT_LOCALE)
  })
})

describe('createI18nStore', () => {
  let cookieJar: string

  beforeEach(() => {
    vi.useFakeTimers()
    cookieJar = ''
    const storage = new Map<string, string>()

    vi.stubGlobal('window', {
      location: { protocol: 'http:' },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })

    vi.stubGlobal('document', {
      get cookie() {
        return cookieJar
      },
      set cookie(value: string) {
        const [pair] = value.split(';')
        const [name, rawValue = ''] = pair?.split('=') ?? []
        if (!name) {
          return
        }
        if (value.includes('expires=Thu, 01 Jan 1970')) {
          cookieJar = cookieJar
            .split('; ')
            .filter((part) => !part.startsWith(`${name}=`))
            .join('; ')
          return
        }
        const next = `${name}=${rawValue}`
        const others = cookieJar
          .split('; ')
          .filter(Boolean)
          .filter((part) => !part.startsWith(`${name}=`))
        cookieJar = [...others, next].join('; ')
      },
    })

    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value)
      },
      removeItem: (key: string) => {
        storage.delete(key)
      },
    })
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function createMockI18n(language = 'fr') {
    const instance = {
      language,
      changeLanguage: vi.fn(async (next: string) => {
        instance.language = next
      }),
    }
    return instance as unknown as i18n
  }

  it('setLanguage updates i18n, cookie, and persisted language with SupportedLocale keys', () => {
    const i18nInstance = createMockI18n('fr')
    const useStore = createI18nStore(i18nInstance, 'fr')

    useStore.getState().setLanguage('en')
    vi.runOnlyPendingTimers()

    expect(i18nInstance.changeLanguage).toHaveBeenCalledWith('en')
    expect(useStore.getState().language).toBe('en')
    expect(getLocaleCookie()).toBe('en')
    expect(JSON.parse(localStorage.getItem(I18N_STORE_STORAGE_KEY) ?? '{}')).toMatchObject({
      language: 'en',
    })
  })

  it('normalizes legacy BCP-47 values passed to setLanguage', () => {
    const i18nInstance = createMockI18n('fr')
    const useStore = createI18nStore(i18nInstance, 'fr')

    useStore.getState().setLanguage('en-GB')
    vi.runOnlyPendingTimers()

    expect(i18nInstance.changeLanguage).toHaveBeenCalledWith('en')
    expect(useStore.getState().language).toBe('en')
    expect(getLocaleCookie()).toBe('en')
  })

  it('setLocaleCookie writes SupportedLocale keys readable by getLocaleCookie', () => {
    setLocaleCookie('fr')
    expect(getLocaleCookie()).toBe('fr')
  })
})

describe('findMissingKeys', () => {
  it('reports missing nested keys', () => {
    expect(
      findMissingKeys(
        { auth: { login: { title: 'Sign in', extra: 'X' } } },
        { auth: { login: { title: 'Connexion' } } },
      ),
    ).toEqual(['auth.login.extra'])
  })

  it('reports structure mismatches', () => {
    expect(findMissingKeys({ nested: { a: '1' } }, { nested: 'flat' })).toEqual(['nested'])
  })
})

describe('loadDynamicLocales', () => {
  it('groups modules by locale and namespace', () => {
    const modules = {
      './locales/en/common.locales.en.json': { hello: 'Hello' },
      './locales/fr/common.locales.fr.json': { hello: 'Bonjour' },
      './locales/en/auth.locales.en.json': { title: 'Auth' },
    }

    expect(extractAvailableLocales(modules)).toEqual(['en', 'fr'])
    expect(loadDynamicLocales(modules)).toEqual({
      en: {
        common: { hello: 'Hello' },
        auth: { title: 'Auth' },
      },
      fr: {
        common: { hello: 'Bonjour' },
      },
    })
  })
})
