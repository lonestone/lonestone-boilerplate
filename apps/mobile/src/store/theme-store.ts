import type { ColorSchemeName } from 'react-native'
import { create } from 'zustand'

interface ThemeState {
  colorScheme: ColorSchemeName
  setColorScheme: (scheme: ColorSchemeName) => void
  toggleColorScheme: () => void
}

export const useThemeStore = create<ThemeState>(set => ({
  colorScheme: 'light',
  setColorScheme: colorScheme => set({ colorScheme }),
  toggleColorScheme: () =>
    set(state => ({
      colorScheme: state.colorScheme === 'dark' ? 'light' : 'dark',
    })),
}))
