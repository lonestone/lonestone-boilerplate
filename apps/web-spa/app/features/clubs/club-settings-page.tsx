import { AppLoader } from '@pitchkit/ui/components/app'
import { Button } from '@pitchkit/ui/components/primitives/button'
import { Input } from '@pitchkit/ui/components/primitives/input'
import { toast } from '@pitchkit/ui/components/primitives/sonner'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router'
import { ClubPlayersSection } from '@/features/clubs/club-players-section'
import { useClub } from '@/features/clubs/club-context'
import { EmailPillsInput } from '@/features/onboarding/email-pills-input'
import { authClient } from '@/lib/auth-client'
import { pitchkitApi } from '@/lib/pitchkit-api'

export default function ClubSettingsPage() {
  const { t } = useTranslation()
  const { activeClub, refetchClubs, isClubAdmin, isMembershipLoading, isLoading } = useClub()
  const { data: session } = authClient.useSession()
  const queryClient = useQueryClient()
  const [link, setLink] = useState('')
  const [emails, setEmails] = useState<string[]>([])

  const { data } = useQuery({
    queryKey: ['payment-link', activeClub?.id],
    queryFn: async () => {
      const res = await pitchkitApi.getPaymentLink(activeClub!.id)
      setLink(res.paymentLink ?? '')
      return res
    },
    enabled: !!activeClub && isClubAdmin,
  })

  const save = useMutation({
    mutationFn: () => pitchkitApi.setPaymentLink(activeClub!.id, link || null),
    onSuccess: () => {
      toast.success(t('clubSettings.paymentLink.saved'))
      refetchClubs()
      void queryClient.invalidateQueries({ queryKey: ['payment-link', activeClub?.id] })
    },
  })

  const invite = useMutation({
    mutationFn: async () => {
      if (!activeClub) throw new Error(t('clubSettings.noClub'))
      for (const email of emails) {
        const result = await authClient.organization.inviteMember({
          email,
          role: 'member',
          organizationId: activeClub.id,
        })
        if (result.error) throw new Error(result.error.message)
      }
    },
    onSuccess: () => {
      toast.success(t('clubSettings.invite.success'))
      setEmails([])
      void queryClient.invalidateQueries({ queryKey: ['club-players', activeClub?.id] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isLoading || isMembershipLoading) return <AppLoader />
  if (!activeClub) return <div className="p-6">{t('clubSettings.noClub')}</div>
  if (!isClubAdmin) return <Navigate to="/dashboard" replace />

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('clubSettings.title')}</h1>
        <p className="text-muted-foreground">{activeClub.name}</p>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">{t('clubSettings.invite.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('clubSettings.invite.hint')}</p>
        <EmailPillsInput
          emails={emails}
          onChange={setEmails}
          placeholder={t('clubSettings.invite.placeholder')}
        />
        <Button
          disabled={invite.isPending || emails.length === 0}
          onClick={() => invite.mutate()}
        >
          {t('clubSettings.invite.send')}
        </Button>
      </section>

      <ClubPlayersSection
        organizationId={activeClub.id}
        currentUserId={session?.user?.id}
      />

      <section className="space-y-2">
        <h2 className="text-lg font-medium">{t('clubSettings.paymentLink.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('clubSettings.paymentLink.hint')}</p>
        <Input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder={data?.paymentLink ?? 'https://…'}
        />
        <Button onClick={() => save.mutate()}>{t('clubSettings.paymentLink.save')}</Button>
      </section>
    </div>
  )
}
