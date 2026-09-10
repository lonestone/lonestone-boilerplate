import { Badge } from '@pitchkit/ui/components/primitives/badge'
import { Button } from '@pitchkit/ui/components/primitives/button'
import { toast } from '@pitchkit/ui/components/primitives/sonner'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, RefreshCw, Shield, ShieldOff, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { authClient } from '@/lib/auth-client'
import { pitchkitApi, type ClubMember } from '@/lib/pitchkit-api'

interface PendingInvitation {
  id: string
  email: string
  role: string
  status: string
  organizationId: string
  expiresAt: string | Date
}

type PlayerRow =
  | {
      kind: 'member'
      id: string
      email: string
      name: string
      role: ClubMember['role']
      canRemove: boolean
      canChangeRole: boolean
    }
  | {
      kind: 'invitation'
      id: string
      email: string
      name: string
      canRemove: boolean
    }

interface ClubPlayersSectionProps {
  organizationId: string
  currentUserId: string | undefined
}

export function ClubPlayersSection({ organizationId, currentUserId }: ClubPlayersSectionProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const playersQueryKey = ['club-players', organizationId] as const

  const { data: rows = [], isLoading } = useQuery({
    queryKey: playersQueryKey,
    queryFn: async (): Promise<PlayerRow[]> => {
      const [members, invitationsResult] = await Promise.all([
        pitchkitApi.listMembers(organizationId),
        authClient.organization.listInvitations({
          query: { organizationId },
        }),
      ])

      if (invitationsResult.error) {
        throw new Error(invitationsResult.error.message)
      }

      const pending = ((invitationsResult.data ?? []) as PendingInvitation[]).filter(
        (invitation) => invitation.status === 'pending',
      )

      const memberRows: PlayerRow[] = members.map((member) => ({
        kind: 'member' as const,
        id: member.id,
        email: member.email,
        name: member.name || member.email,
        role: member.role,
        canRemove: member.role !== 'owner' && member.userId !== currentUserId,
        canChangeRole: member.role !== 'owner',
      }))

      const invitationRows: PlayerRow[] = pending.map((invitation) => ({
        kind: 'invitation' as const,
        id: invitation.id,
        email: invitation.email,
        name: invitation.email,
        canRemove: true,
      }))

      return [...memberRows, ...invitationRows]
    },
  })

  const invalidatePlayers = () => {
    void queryClient.invalidateQueries({ queryKey: playersQueryKey })
    void queryClient.invalidateQueries({ queryKey: ['club-members', organizationId] })
  }

  const resend = useMutation({
    mutationFn: async (email: string) => {
      const result = await authClient.organization.inviteMember({
        email,
        role: 'member',
        organizationId,
        resend: true,
      })
      if (result.error) throw new Error(result.error.message)
    },
    onSuccess: () => {
      toast.success(t('clubSettings.players.resent'))
      invalidatePlayers()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const changeRole = useMutation({
    mutationFn: async ({
      memberId,
      role,
    }: {
      memberId: string
      role: 'admin' | 'member'
    }) => {
      await pitchkitApi.updateMemberRole(organizationId, memberId, role)
    },
    onSuccess: (_data, variables) => {
      toast.success(
        variables.role === 'admin'
          ? t('clubSettings.players.promoted')
          : t('clubSettings.players.demoted'),
      )
      invalidatePlayers()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const remove = useMutation({
    mutationFn: async (row: PlayerRow) => {
      if (row.kind === 'member') {
        const result = await authClient.organization.removeMember({
          memberIdOrEmail: row.id,
          organizationId,
        })
        if (result.error) throw new Error(result.error.message)
        return
      }

      const result = await authClient.organization.cancelInvitation({
        invitationId: row.id,
      })
      if (result.error) throw new Error(result.error.message)
    },
    onSuccess: () => {
      toast.success(t('clubSettings.players.removed'))
      invalidatePlayers()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const isBusy = resend.isPending || remove.isPending || changeRole.isPending

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-medium">{t('clubSettings.players.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('clubSettings.players.hint')}</p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t('common.loading')}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('clubSettings.players.empty')}</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {rows.map((row) => (
            <li key={`${row.kind}-${row.id}`} className="flex items-start gap-3 p-3">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate font-medium">{row.name}</p>
                {row.kind === 'member' && row.name !== row.email ? (
                  <p className="truncate text-sm text-muted-foreground">{row.email}</p>
                ) : null}
                <div>
                  {row.kind === 'invitation' ? (
                    <Badge variant="secondary">{t('clubSettings.players.statusInvited')}</Badge>
                  ) : (
                    <Badge variant="outline">
                      {t(`clubSettings.players.roles.${row.role}`)}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-1">
                {row.kind === 'invitation' ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => resend.mutate(row.email)}
                    aria-label={t('clubSettings.players.resend')}
                  >
                    <RefreshCw className="size-4" />
                    <span className="hidden sm:inline">{t('clubSettings.players.resend')}</span>
                  </Button>
                ) : null}
                {row.kind === 'member' && row.canChangeRole ? (
                  row.role === 'admin' ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isBusy}
                      onClick={() =>
                        changeRole.mutate({ memberId: row.id, role: 'member' })
                      }
                      aria-label={t('clubSettings.players.removeAdmin')}
                    >
                      <ShieldOff className="size-4" />
                      <span className="hidden sm:inline">
                        {t('clubSettings.players.removeAdmin')}
                      </span>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isBusy}
                      onClick={() =>
                        changeRole.mutate({ memberId: row.id, role: 'admin' })
                      }
                      aria-label={t('clubSettings.players.makeAdmin')}
                    >
                      <Shield className="size-4" />
                      <span className="hidden sm:inline">
                        {t('clubSettings.players.makeAdmin')}
                      </span>
                    </Button>
                  )
                ) : null}
                {row.canRemove ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => remove.mutate(row)}
                    aria-label={t('clubSettings.players.remove')}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                    <span className="hidden sm:inline">{t('clubSettings.players.remove')}</span>
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
