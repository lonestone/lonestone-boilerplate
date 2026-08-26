import type { Route } from './+types/root'
import { getHtmlLang, normalizeLocale } from '@boilerstone/i18n/config'
import { client } from '@boilerstone/openapi-generator'
import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router'
import { useI18nStore } from '@/lib/i18n/i18n-client'
import { queryClient } from '@/lib/query-client'
import useTheme from './hooks/useTheme'
import '@/lib/i18n/i18n-client'
import '@fontsource/source-sans-pro'
import '@boilerstone/ui/globals.css'

client.setConfig({
  baseUrl: import.meta.env.VITE_API_URL,
  credentials: 'include',
})

export const links: Route.LinksFunction = () => [
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap',
  },
]

export function Layout({ children }: { children: React.ReactNode }) {
  const [theme] = useTheme()
  const language = useI18nStore((state) => state.language)
  const { i18n } = useTranslation()
  const activeLocale = normalizeLocale(i18n.language || language)
  const htmlLang = getHtmlLang(activeLocale)

  useEffect(() => {
    document.body.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    document.documentElement.lang = htmlLang
  }, [htmlLang])

  return (
    <html lang={htmlLang}>
      <head>
        <title>Dashboard</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="author" content="Lonestone" />
        <meta name="keywords" content="Lonestone, platform, create, share, ideas" />

        <meta
          name="description"
          content="Lonestone is a platform for creating and sharing your ideas."
        />
        <Meta />
        <Links />
      </head>
      <body className="dark bg-gradient-bg">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  )
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { t } = useTranslation()
  let message: string = t('error.oops')
  let details: string = t('error.default')
  let stack: string | undefined

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? '404' : t('common.error')
    details =
      error.status === 404 ? t('error.pageNotFoundDescription') : error.statusText || details
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message
    stack = error.stack
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  )
}
