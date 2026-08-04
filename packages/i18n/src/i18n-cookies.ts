/**
 * Cookie utilities for i18n locale management (SPA mirror + SSR resolution).
 *
 * Cookie value identity matches i18next language keys (`en` | `fr`).
 * Legacy BCP-47 values (`fr-FR`, `en-GB`) are accepted and normalized on read.
 */

import type { SupportedLocale } from './i18n-config'
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  SUPPORTED_LOCALE_KEYS,
  SUPPORTED_LOCALES,
} from './i18n-config'

export interface CookieInfo {
  locale: SupportedLocale | null
  isValid: boolean
  supportedLocales: SupportedLocale[]
}

export interface CookieOptions {
  expires?: Date
  maxAge?: number
  path?: string
  domain?: string
  secure?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
}

const LOCALE_COOKIE_NAME = 'locale'

function shouldUseSecureCookie(): boolean {
  if (typeof window === 'undefined') {
    return true
  }

  return window.location.protocol === 'https:'
}

/**
 * Parse cookie string into key-value pairs
 */
export function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {}

  if (!cookieHeader) {
    return cookies
  }

  const cookiePairs = cookieHeader.split(';')

  for (const pair of cookiePairs) {
    const separatorIndex = pair.indexOf('=')
    if (separatorIndex === -1) {
      continue
    }

    const name = pair.slice(0, separatorIndex).trim()
    const value = pair.slice(separatorIndex + 1).trim()
    if (name && value) {
      cookies[name] = decodeURIComponent(value)
    }
  }

  return cookies
}

/**
 * Map a language tag to a SupportedLocale key (e.g. `fr-FR` → `fr`).
 */
export function matchSupportedLocale(
  tag: string,
  supportedLocales: readonly SupportedLocale[] = SUPPORTED_LOCALE_KEYS,
): SupportedLocale | null {
  if (isSupportedLocale(tag) && supportedLocales.includes(tag)) {
    return tag
  }

  const languageCode = tag.split('-')[0]?.toLowerCase()
  if (languageCode && isSupportedLocale(languageCode) && supportedLocales.includes(languageCode)) {
    return languageCode
  }

  for (const key of supportedLocales) {
    if (SUPPORTED_LOCALES[key].htmlLang === tag) {
      return key
    }
  }

  return null
}

/**
 * Extract locale from cookies. Accepts SupportedLocale keys and legacy BCP-47 tags.
 */
export function getLocaleFromCookies(
  cookieHeader: string | undefined,
  supportedLocales: readonly SupportedLocale[] = SUPPORTED_LOCALE_KEYS,
): CookieInfo {
  if (!cookieHeader) {
    return {
      locale: null,
      isValid: false,
      supportedLocales: [...supportedLocales],
    }
  }

  const cookies = parseCookies(cookieHeader)
  const rawLocale = cookies[LOCALE_COOKIE_NAME]
  const locale = rawLocale ? matchSupportedLocale(rawLocale, supportedLocales) : null

  if (!locale) {
    return {
      locale: null,
      isValid: false,
      supportedLocales: [...supportedLocales],
    }
  }

  return {
    locale,
    isValid: true,
    supportedLocales: [...supportedLocales],
  }
}

/**
 * Get default locale based on Accept-Language header
 */
export function getDefaultLocaleFromAcceptLanguage(
  acceptLanguageHeader: string | undefined,
  supportedLocales: readonly SupportedLocale[] = SUPPORTED_LOCALE_KEYS,
): SupportedLocale | null {
  if (!acceptLanguageHeader) {
    return null
  }

  const languages = acceptLanguageHeader
    .split(',')
    .map((lang) => {
      const [locale, qValue] = lang.trim().split(';q=')
      return {
        locale: locale?.trim(),
        quality: qValue ? Number.parseFloat(qValue) : 1.0,
      }
    })
    .sort((a, b) => b.quality - a.quality)

  for (const { locale } of languages) {
    if (!locale) {
      continue
    }

    const matched = matchSupportedLocale(locale, supportedLocales)
    if (matched) {
      return matched
    }
  }

  return null
}

export function setCookie(name: string, value: string, options: CookieOptions = {}): void {
  if (typeof document === 'undefined') {
    return
  }

  const {
    expires,
    maxAge,
    path = '/',
    domain,
    secure = shouldUseSecureCookie(),
    sameSite = 'lax',
  } = options

  let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`

  if (expires) {
    cookieString += `; expires=${expires.toUTCString()}`
  }

  if (maxAge !== undefined) {
    cookieString += `; max-age=${maxAge}`
  }

  cookieString += `; path=${path}`

  if (domain) {
    cookieString += `; domain=${domain}`
  }

  if (secure) {
    cookieString += '; secure'
  }

  cookieString += `; samesite=${sameSite}`

  document.cookie = cookieString
}

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null
  }

  const cookies = document.cookie.split(';')

  for (const cookie of cookies) {
    const separatorIndex = cookie.indexOf('=')
    if (separatorIndex === -1) {
      continue
    }

    const cookieName = cookie.slice(0, separatorIndex).trim()
    const cookieValue = cookie.slice(separatorIndex + 1).trim()
    if (cookieName === name) {
      return decodeURIComponent(cookieValue)
    }
  }

  return null
}

export function removeCookie(
  name: string,
  options: Pick<CookieOptions, 'path' | 'domain'> = {},
): void {
  const { path = '/', domain } = options

  setCookie(name, '', {
    expires: new Date(0),
    path,
    domain,
    secure: shouldUseSecureCookie(),
  })
}

export function setLocaleCookie(locale: SupportedLocale, domain?: string): void {
  setCookie(LOCALE_COOKIE_NAME, locale, {
    maxAge: 365 * 24 * 60 * 60,
    path: '/',
    sameSite: 'lax',
    domain,
  })
}

export function getLocaleCookie(): SupportedLocale | null {
  const locale = getCookie(LOCALE_COOKIE_NAME)
  return locale ? matchSupportedLocale(locale) : null
}

export function removeLocaleCookie(): void {
  removeCookie(LOCALE_COOKIE_NAME)
}

/**
 * Client bootstrap helper: cookie → browser language → default.
 * Prefer reading persisted Zustand state before calling this when available.
 */
export function getInitialLocale(): SupportedLocale {
  const cookieLocale = getLocaleCookie()
  if (cookieLocale) {
    return cookieLocale
  }

  if (typeof navigator !== 'undefined') {
    const browserLang = navigator.language || navigator.languages?.[0]
    if (browserLang) {
      const matched = matchSupportedLocale(browserLang)
      if (matched) {
        return matched
      }
    }
  }

  return DEFAULT_LOCALE
}

/**
 * Server-side resolution for SSR loaders: cookie → Accept-Language → default.
 */
export function getLocaleFromRequestWithFallback(request: {
  headers: { cookie?: string; 'accept-language'?: string }
}): SupportedLocale {
  const cookieInfo = getLocaleFromCookies(request.headers.cookie)
  if (cookieInfo.isValid && cookieInfo.locale) {
    return cookieInfo.locale
  }

  const browserLocale = getDefaultLocaleFromAcceptLanguage(request.headers['accept-language'])
  if (browserLocale) {
    return browserLocale
  }

  return DEFAULT_LOCALE
}
