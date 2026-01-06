// eslint-disable-next-line ts/no-require-imports
const tailwindConfig = require('../../tailwind.config.js')

/**
 * Colors from tailwind.config.js
 * Use for components that don't support Tailwind classes (e.g., Lucide icons)
 */
export const colors = tailwindConfig.theme.extend.colors as {
  'primary': string
  'primary-foreground': string
  'muted': string
  'border': string
  'card': string
  'card-foreground': string
  'background': string
  'foreground': string
  'destructive': string
  'destructive-foreground': string
  'secondary': string
  'secondary-foreground': string
  'accent': string
  'accent-foreground': string
  'input': string
  'ring': string
  'muted-foreground': string
}
