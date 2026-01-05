import { colorsDark, colorsLight, layout, radius } from '../design-tokens'

export type ThemeScheme = 'light' | 'dark'

interface ApplyThemeVariablesOptions {
  scheme?: ThemeScheme
  root?: HTMLElement
  classTarget?: HTMLElement | null
}

function getThemeTokens(scheme: ThemeScheme) {
  const colors = scheme === 'dark' ? colorsDark : colorsLight
  return {
    ...colors,
    'radius': radius.lg,
    'header-height': layout.headerHeight,
  }
}

export function getThemeCssText(scheme: ThemeScheme) {
  const tokens = getThemeTokens(scheme)
  const declarations = Object.entries(tokens)
    .map(([key, value]) => `--${key}: ${value};`)
    .join('')

  return `:root{${declarations}}`
}

export function applyThemeVariables({
  scheme = 'light',
  root = document.documentElement,
  classTarget = document.body,
}: ApplyThemeVariablesOptions = {}) {
  const tokens = getThemeTokens(scheme)

  Object.entries(tokens).forEach(([key, value]) => {
    root.style.setProperty(`--${key}`, value)
  })

  const resolvedClassTarget = classTarget ?? root
  resolvedClassTarget.classList.toggle('dark', scheme === 'dark')
}
