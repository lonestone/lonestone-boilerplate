import { useSyncExternalStore } from 'react'

type Theme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'app-theme'
const THEME_COOKIE_KEY = 'app-theme'

export function getThemeFromLocalStorage(): Theme {
  const cookieMatch = document.cookie.match(
    new RegExp(`(?:^|; )${THEME_COOKIE_KEY}=([^;]*)`),
  )
  const cookieTheme = cookieMatch?.[1] as Theme | undefined

  if (cookieTheme === 'light' || cookieTheme === 'dark') {
    return cookieTheme
  }

  return (localStorage.getItem(THEME_STORAGE_KEY) as Theme) || 'dark'
};

function setThemeCookie(theme: Theme) {
  document.cookie = `${THEME_COOKIE_KEY}=${theme}; path=/; max-age=31536000; samesite=lax`
}

function subscribe(callback: () => void): (() => void) {
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener('storage', callback)
  }
};

function useTheme(): [Theme, (newTheme: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, getThemeFromLocalStorage, () => 'dark' as Theme)

  const setTheme = (newTheme: Theme) => {
    localStorage.setItem(THEME_STORAGE_KEY, newTheme)
    setThemeCookie(newTheme)
    window.dispatchEvent(new Event('storage'))
  }

  return [theme, setTheme]
};

export default useTheme
