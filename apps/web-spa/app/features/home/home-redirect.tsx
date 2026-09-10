import { AppLoader } from '@pitchkit/ui/components/app'
import { useQuery } from '@tanstack/react-query'
import { Navigate } from 'react-router'
import { acceptPendingInvitations } from '@/features/auth/utils/pending-invitation'
import { authClient } from '@/lib/auth-client'
import { pitchkitApi } from '@/lib/pitchkit-api'

export default function HomeRedirect() {
  const { data: session, isPending: isSessionPending } = authClient.useSession()

  const { data: clubs, isLoading: isClubsLoading } = useQuery({
    queryKey: ['clubs', session?.user?.id, 'gate'],
    queryFn: async () => {
      await acceptPendingInvitations()
      return pitchkitApi.listClubs()
    },
    enabled: !!session?.user,
  })

  if (isSessionPending) return <AppLoader />
  if (!session) return <Navigate to="/login" replace />
  if (isClubsLoading) return <AppLoader />
  if (!clubs || clubs.length === 0) return <Navigate to="/onboarding" replace />
  return <Navigate to="/dashboard" replace />
}
