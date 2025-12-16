import { useEffect } from 'react'
import { useColorScheme as useRNColorScheme } from 'react-native'
import { useThemeStore } from '@/src/store'

export function useTheme() {
  const systemColorScheme = useRNColorScheme()
  const { colorScheme, setColorScheme, toggleColorScheme } = useThemeStore()

  useEffect(() => {
    // Initialize with system color scheme if not set
    if (!colorScheme && systemColorScheme) {
      setColorScheme(systemColorScheme)
    }
  }, [systemColorScheme, colorScheme, setColorScheme])

  return {
    colorScheme: colorScheme || systemColorScheme || 'light',
    setColorScheme,
    toggleColorScheme,
    isDark: (colorScheme || systemColorScheme) === 'dark',
  }
}
