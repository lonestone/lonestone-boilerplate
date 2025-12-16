import { useEffect } from 'react'
import { authClient } from '@/lib/auth-client'
import { useAuthStore } from '@/src/store'

interface SessionUser {
  id: string
  email: string
  name: string
}

interface SessionData {
  isPending?: boolean
  data?: { user?: SessionUser }
  user?: SessionUser
}

/**
 * Initialize authentication state on app startup
 * Uses Better Auth useSession hook which automatically checks SecureStore
 * and syncs with Zustand store
 */
export function useAuthInitialization() {
  const session = authClient.useSession() as SessionData
  const setUser = useAuthStore(state => state.setUser)

  useEffect(() => {
    // Type guard to handle both query result and direct session data
    const isPending = session?.isPending || false

    if (isPending) {
      return
    }

    // Extract user data - handles both {data: {user}} and {user} structures
    const user = session?.data?.user || session?.user

    if (user) {
      setUser({
        id: user.id,
        email: user.email,
        name: user.name,
      })
    }
    else {
      setUser(null)
    }
  }, [session, setUser])

  const isPending = session?.isPending || false
  return { isInitialized: !isPending }
}
