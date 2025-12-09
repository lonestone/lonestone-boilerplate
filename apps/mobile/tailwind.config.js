/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './features/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
    './App.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        'primary': '#f5d90a',
        'primary-foreground': '#0f172a',
        'muted': '#6b7280',
        'border': '#e5e7eb',
        'card': '#ffffff',
        'card-foreground': '#0f172a',
        'background': '#ffffff',
        'foreground': '#09090b',
        'destructive': '#ef4444',
        'destructive-foreground': '#ffffff',
        'secondary': '#f4f4f5',
        'secondary-foreground': '#18181b',
        'accent': '#f4f4f5',
        'accent-foreground': '#18181b',
        'input': '#e4e4e7',
        'ring': '#18181b',
        'muted-foreground': '#71717a',
      },
    },
  },
  plugins: [],
}
