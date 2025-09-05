import { useSyncExternalStore } from 'react'

type Theme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'app-theme'

function getThemeFromLocalStorage(): Theme {
  return (localStorage.getItem(THEME_STORAGE_KEY) as Theme) || 'dark'
};

function subscribe(callback: () => void): (() => void) {
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener('storage', callback)
  }
};

function useTheme(): [Theme, (newTheme: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, getThemeFromLocalStorage)

  const setTheme = (newTheme: Theme) => {
    localStorage.setItem(THEME_STORAGE_KEY, newTheme)
    window.dispatchEvent(new Event('storage'))
  }

  return [theme, setTheme]
};

export default useTheme
