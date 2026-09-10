import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { authClient } from '@/lib/auth-client'
import { pitchkitApi, type Club, type ClubMember } from '@/lib/pitchkit-api'

type ClubRole = ClubMember['role']

interface ClubContextValue {
  clubs: Club[]
  activeClub: Club | null
  setActiveClubId: (id: string) => Promise<void>
  isLoading: boolean
  refetchClubs: () => void
  myMembership: ClubMember | null
  isClubAdmin: boolean
  isMembershipLoading: boolean
}

const ClubContext = createContext<ClubContextValue | null>(null)

function isAdminRole(role: ClubRole | undefined): boolean {
  return role === 'owner' || role === 'admin'
}

export function ClubProvider({ children }: { children: ReactNode }) {
  const { data: session } = authClient.useSession()
  const [activeClubId, setActiveClubIdState] = useState<string | null>(
    () => localStorage.getItem('pitchkit.activeClubId'),
  )

  const {
    data: clubs = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['clubs', session?.user?.id],
    queryFn: () => pitchkitApi.listClubs(),
    enabled: !!session?.user,
  })

  useEffect(() => {
    if (!activeClubId && clubs.length > 0) {
      const firstId = clubs[0].id
      setActiveClubIdState(firstId)
      localStorage.setItem('pitchkit.activeClubId', firstId)
      void authClient.organization.setActive({ organizationId: firstId })
    }
  }, [clubs, activeClubId])

  const activeClub = useMemo(
    () => clubs.find((c) => c.id === activeClubId) ?? clubs[0] ?? null,
    [clubs, activeClubId],
  )

  useEffect(() => {
    if (!activeClub?.id) return
    void authClient.organization.setActive({ organizationId: activeClub.id })
  }, [activeClub?.id])

  const { data: members = [], isLoading: isMembershipLoading } = useQuery({
    queryKey: ['club-members', activeClub?.id, session?.user?.id],
    queryFn: () => pitchkitApi.listMembers(activeClub!.id),
    enabled: !!activeClub && !!session?.user,
  })

  const myMembership = useMemo(
    () => members.find((m) => m.userId === session?.user?.id) ?? null,
    [members, session?.user?.id],
  )

  const isClubAdmin = isAdminRole(myMembership?.role)

  const setActiveClubId = async (id: string) => {
    setActiveClubIdState(id)
    localStorage.setItem('pitchkit.activeClubId', id)
    await authClient.organization.setActive({ organizationId: id })
  }

  return (
    <ClubContext.Provider
      value={{
        clubs,
        activeClub,
        setActiveClubId,
        isLoading,
        refetchClubs: () => {
          void refetch()
        },
        myMembership,
        isClubAdmin,
        isMembershipLoading,
      }}
    >
      {children}
    </ClubContext.Provider>
  )
}

export function useClub() {
  const ctx = useContext(ClubContext)
  if (!ctx) throw new Error('useClub must be used within ClubProvider')
  return ctx
}
