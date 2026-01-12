/**
 * Shared cookie utilities for i18n locale management
 */

import type { DefaultLocale, SupportedLocale } from './i18n-config.js'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './i18n-config.js'

export interface CookieInfo {
  locale: string | null
  isValid: boolean
  supportedLocales: string[]
}

export interface CookieOptions {
  expires?: Date
  maxAge?: number
  path?: string
  domain?: string
  secure?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
  httpOnly?: boolean
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
    const [name, value] = pair.trim().split('=')
    if (name && value) {
      cookies[name] = decodeURIComponent(value)
    }
  }

  return cookies
}

/**
 * Extract locale from cookies
 */
export function getLocaleFromCookies(
  cookieHeader: string | undefined,
  supportedLocales: readonly string[] = Object.values(SUPPORTED_LOCALES).map(l => l.defaultLocale),
): CookieInfo {
  if (!cookieHeader) {
    return {
      locale: null,
      isValid: false,
      supportedLocales: [...supportedLocales],
    }
  }

  const cookies = parseCookies(cookieHeader)
  const locale = cookies.locale

  if (!locale) {
    return {
      locale: null,
      isValid: false,
      supportedLocales: [...supportedLocales],
    }
  }

  const isValid = supportedLocales.includes(locale)

  return {
    locale: isValid ? locale : null,
    isValid,
    supportedLocales: [...supportedLocales],
  }
}

/**
 * Get default locale based on Accept-Language header
 */
export function getDefaultLocaleFromAcceptLanguage(
  acceptLanguageHeader: string | undefined,
  supportedLocales: readonly string[] = Object.values(SUPPORTED_LOCALES).map(l => l.defaultLocale),
): string | null {
  if (!acceptLanguageHeader) {
    return null
  }

  // Parse Accept-Language header (e.g., "fr-FR,fr;q=0.9,en;q=0.8")
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

  // Find the first supported language
  for (const { locale } of languages) {
    if (!locale) {
      continue
    }

    // Check exact match first
    if (supportedLocales.includes(locale)) {
      return locale
    }

    // Check language code match (e.g., "fr" matches "fr-FR")
    const languageCode = locale.split('-')[0]
    const supportedLocale = supportedLocales.find(supported =>
      supported.startsWith(languageCode ?? ''),
    )

    if (supportedLocale) {
      return supportedLocale
    }
  }

  return null
}

// Client-side utilities (only work in browser)
export function setCookie(name: string, value: string, options: CookieOptions = {}): void {
  if (typeof document === 'undefined') {
    return
  }

  const {
    expires,
    maxAge,
    path = '/',
    domain,
    secure = true,
    sameSite = 'lax',
    httpOnly = false,
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

  if (httpOnly) {
    cookieString += '; httponly'
  }

  document.cookie = cookieString
}

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null
  }

  const cookies = document.cookie.split(';')

  for (const cookie of cookies) {
    const [cookieName, cookieValue] = cookie.trim().split('=')
    if (cookieName === name) {
      return decodeURIComponent(cookieValue ?? '')
    }
  }

  return null
}

export function removeCookie(name: string, options: Pick<CookieOptions, 'path' | 'domain'> = {}): void {
  const { path = '/', domain } = options

  setCookie(name, '', {
    expires: new Date(0),
    path,
    domain,
  })
}

export function setLocaleCookie(locale: SupportedLocale, domain?: string): void {
  setCookie('locale', locale, {
    maxAge: 365 * 24 * 60 * 60, // 1 year
    path: '/',
    secure: true,
    sameSite: 'lax',
    domain,
  })
}

export function getLocaleCookie(): SupportedLocale | null {
  const locale = getCookie('locale')
  return locale && Object.values(SUPPORTED_LOCALES).map(l => l.defaultLocale).includes(locale as DefaultLocale)
    ? (locale as SupportedLocale)
    : null
}

export function removeLocaleCookie(): void {
  removeCookie('locale')
}

export function getInitialLocale(): SupportedLocale {
  // First, try to get from cookie
  const cookieLocale = getLocaleCookie()
  if (cookieLocale) {
    return cookieLocale
  }

  // Fallback to browser language
  const browserLang = navigator.language || navigator.languages?.[0]
  if (browserLang) {
    // Check if browser language matches any supported locale
    const supportedLocale = Object.values(SUPPORTED_LOCALES).find(
      locale => browserLang?.startsWith(locale.defaultLocale.split('-')[0] ?? '') ?? false,
    )
    if (supportedLocale) {
      return supportedLocale.defaultLocale as SupportedLocale
    }
  }

  return DEFAULT_LOCALE as SupportedLocale
}

// Server-side utilities
export function getLocaleFromRequestWithFallback(request: { headers: { 'cookie'?: string, 'accept-language'?: string } }): SupportedLocale {
  // First, try to get from cookies
  const cookieInfo = getLocaleFromCookies(request.headers.cookie)
  if (cookieInfo.isValid && cookieInfo.locale) {
    return cookieInfo.locale as SupportedLocale
  }

  // Fallback to Accept-Language header
  const acceptLanguage = request.headers['accept-language']
  const browserLocale = getDefaultLocaleFromAcceptLanguage(acceptLanguage)

  if (browserLocale && Object.values(SUPPORTED_LOCALES).map(l => l.defaultLocale).includes(browserLocale as DefaultLocale)) {
    return browserLocale as SupportedLocale
  }

  return DEFAULT_LOCALE as SupportedLocale
}
