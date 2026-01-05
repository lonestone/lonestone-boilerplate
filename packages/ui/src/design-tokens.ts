// Design Tokens partagés entre Web et Mobile
// Source de vérité unique pour couleurs, espacements, fonts, radius

// === COULEURS (Format Hex pour Mobile + Web) ===
export const colorsLight = {
  'primary': '#f5d90a',
  'primary-foreground': '#0f172a',
  'secondary': '#f4f4f5',
  'secondary-foreground': '#18181b',
  'destructive': '#ef4444',
  'destructive-foreground': '#ffffff',
  'muted': '#6b7280',
  'muted-foreground': '#71717a',
  'accent': '#f4f4f5',
  'accent-foreground': '#18181b',
  'background': '#ffffff',
  'foreground': '#09090b',
  'card': '#ffffff',
  'card-foreground': '#0f172a',
  'popover': '#ffffff',
  'popover-foreground': '#09090b',
  'border': '#e5e7eb',
  'input': '#e4e4e7',
  'ring': '#18181b',
  'chart-1': '#f54900',
  'chart-2': '#009689',
  'chart-3': '#104e64',
  'chart-4': '#ffb900',
  'chart-5': '#fe9a00',
  'sidebar': '#fafafa',
  'sidebar-foreground': '#0a0a0a',
  'sidebar-primary': '#171717',
  'sidebar-primary-foreground': '#fafafa',
  'sidebar-accent': '#f5f5f5',
  'sidebar-accent-foreground': '#171717',
  'sidebar-border': '#e5e5e5',
  'sidebar-ring': '#a1a1a1',
}

export const colorsDark = {
  'background': '#0a0a0a',
  'foreground': '#fafafa',
  'card': '#0a0a0a',
  'card-foreground': '#fafafa',
  'popover': '#0a0a0a',
  'popover-foreground': '#fafafa',
  'primary': '#fff056',
  'primary-foreground': '#171717',
  'secondary': '#262626',
  'secondary-foreground': '#fafafa',
  'muted': '#262626',
  'muted-foreground': '#a1a1a1',
  'accent': '#262626',
  'accent-foreground': '#fafafa',
  'destructive': '#be0038',
  'destructive-foreground': '#fb2c36',
  'border': '#262626',
  'input': '#262626',
  'ring': '#525252',
  'chart-1': '#1447e6',
  'chart-2': '#00bc7d',
  'chart-3': '#fe9a00',
  'chart-4': '#ad46ff',
  'chart-5': '#ff2056',
  'sidebar': '#171717',
  'sidebar-foreground': '#fafafa',
  'sidebar-primary': '#1447e6',
  'sidebar-primary-foreground': '#fafafa',
  'sidebar-accent': '#262626',
  'sidebar-accent-foreground': '#fafafa',
  'sidebar-border': '#262626',
  'sidebar-ring': '#525252',
}

export const colors = colorsLight

// === COULEURS WEB ===
// Le web applique ces valeurs via le helper `applyThemeVariables`.

// === ESPACEMENTS ===
export const spacing = {
  'xs': '0.5rem', // 8px
  'sm': '0.75rem', // 12px
  'md': '1rem', // 16px
  'lg': '1.5rem', // 24px
  'xl': '2rem', // 32px
  '2xl': '3rem', // 48px
}

// === BORDER RADIUS ===
export const radius = {
  sm: 'calc(0.625rem - 4px)', // radius-sm
  md: 'calc(0.625rem - 2px)', // radius-md
  lg: '0.625rem', // radius-lg (default)
  xl: 'calc(0.625rem + 4px)', // radius-xl
}

// === FONTS ===
export const fonts = {
  display: '\'Source Sans Pro\', sans-serif',
  body: 'system-ui, sans-serif',
}

export const layout = {
  headerHeight: '3rem',
}
