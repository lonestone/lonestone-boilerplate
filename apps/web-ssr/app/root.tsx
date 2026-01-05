import type { Route } from './+types/root'
import process from 'node:process'
import { client } from '@boilerstone/openapi-generator'
import { getThemeCssText } from '@boilerstone/ui/lib/apply-theme-variables'
import { HydrationBoundary, QueryClientProvider } from '@tanstack/react-query'
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteLoaderData } from 'react-router'
import { useDehydratedState } from '@/hooks/use-dehydrated-state'
import { queryClient } from '@/lib/query-client'
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

type Theme = 'light' | 'dark'

function getThemeFromRequest(request: Request): Theme {
  const cookieHeader = request.headers.get('cookie') ?? ''
  const match = cookieHeader.match(/(?:^|; )app-theme=([^;]*)/)
  const cookieTheme = match?.[1]

  if (cookieTheme === 'light' || cookieTheme === 'dark') {
    return cookieTheme
  }

  return 'dark'
}

export async function loader({ request }: Route.LoaderArgs) {
  return {
    API_URL: process.env.API_URL as string,
    theme: getThemeFromRequest(request),
  }
}

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>('root')
  const theme = data?.theme ?? 'dark'
  const bodyClassName = `${theme === 'dark' ? 'dark ' : ''}font-display min-h-screen bg-background`

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <style
          id="theme-variables"
          // eslint-disable-next-line react-dom/no-dangerously-set-innerhtml -- CSS variables injected from tokens
          dangerouslySetInnerHTML={{ __html: getThemeCssText(theme) }}
        />
      </head>
      <body className={bodyClassName}>
        {children}
        <ScrollRestoration />
        <Scripts />
        {/* Inject the API URL into the window object */}
        {/* eslint-disable-next-line react-dom/no-dangerously-set-innerhtml -- ignore */}
        <script dangerouslySetInnerHTML={{
          __html: `window.ENV = ${JSON.stringify(data)}`,
        }}
        />
      </body>
    </html>
  )
}

export default function App() {
  const dehydratedState = useDehydratedState()
  return (
    <QueryClientProvider client={queryClient}>
      <HydrationBoundary state={dehydratedState}>
        <Outlet />
      </HydrationBoundary>
    </QueryClientProvider>
  )
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = 'Oops!'
  let details = 'An unexpected error occurred.'
  let stack: string | undefined

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? '404' : 'Error'
    details
      = error.status === 404
        ? 'The requested page could not be found.'
        : error.statusText || details
  }
  else if (import.meta.env.DEV && error && error instanceof Error) {
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
