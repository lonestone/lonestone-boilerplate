import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router'
import { storePendingInvitationId } from '@/features/auth/utils/pending-invitation'

const APP_STORE_URL = import.meta.env.VITE_APP_STORE_URL ?? 'https://apps.apple.com'
const PLAY_STORE_URL = import.meta.env.VITE_PLAY_STORE_URL ?? 'https://play.google.com/store'

export default function InvitePage() {
  const { t } = useTranslation()
  const { invitationId } = useParams()
  const [params] = useSearchParams()
  const email = params.get('email')
  const club = params.get('club')

  useEffect(() => {
    if (invitationId) storePendingInvitationId(invitationId)
  }, [invitationId])

  useEffect(() => {
    const ua = navigator.userAgent || ''
    const isMobile = /iPhone|iPad|Android/i.test(ua)
    if (!isMobile && invitationId) {
      const q = new URLSearchParams()
      if (email) q.set('email', email)
      if (club) q.set('club', club)
      q.set('invitationId', invitationId)
      window.location.href = `/register?${q.toString()}`
    }
  }, [invitationId, email, club])

  const deepLink = `rosti://invite?token=${invitationId ?? ''}&email=${encodeURIComponent(email ?? '')}`

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold">
          {t('invite.title', { club: club || t('invite.fallbackClub') })}
        </h1>
        <p className="text-muted-foreground">
          {email ? t('invite.descriptionWithEmail', { email }) : t('invite.description')}
        </p>
        <div className="flex flex-col gap-2">
          <a className="underline" href={APP_STORE_URL}>
            {t('invite.appStore')}
          </a>
          <a className="underline" href={PLAY_STORE_URL}>
            {t('invite.playStore')}
          </a>
          <a className="underline" href={deepLink}>
            {t('invite.openApp')}
          </a>
          <Link
            className="underline"
            to={`/register?invitationId=${invitationId ?? ''}&email=${encodeURIComponent(email ?? '')}&club=${encodeURIComponent(club ?? '')}`}
          >
            {t('invite.continueDesktop')}
          </Link>
        </div>
      </div>
    </div>
  )
}
