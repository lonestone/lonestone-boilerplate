import type { ReactNode } from 'react'
import { Navigate } from 'react-router'

interface AuthRedirectProps {
  /** Whether the current user is authenticated. */
  isAuthenticated: boolean
  /** Where to redirect when not authenticated. Defaults to `/login`. */
  redirectTo?: string
  /** Content to render when authenticated. */
  children: ReactNode
  /** Fallback rendered while auth state is being determined (e.g. initial load). */
  loading?: ReactNode
  /** When true the auth state is still being resolved — shows `loading` instead of redirecting. */
  isLoading?: boolean
}

/**
 * React Router v7 auth guard.
 * Redirects unauthenticated users; renders children when authenticated.
 *
 * @example
 * <AuthRedirect isAuthenticated={!!user} isLoading={authIsLoading}>
 *   <ProtectedPage />
 * </AuthRedirect>
 */
export function AuthRedirect({
  isAuthenticated,
  redirectTo = '/login',
  children,
  loading,
  isLoading = false,
}: AuthRedirectProps) {
  if (isLoading) {
    return loading ? <>{loading}</> : null
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace />
  }

  return <>{children}</>
}
