import { useParams, useSearchParams } from 'react-router'
import RostiLogo from '@/assets/images/rosti-logo.svg'

const SPA_URL = import.meta.env.VITE_SPA_URL ?? 'http://localhost:5174'
const APP_STORE_URL = import.meta.env.VITE_APP_STORE_URL ?? 'https://apps.apple.com'
const PLAY_STORE_URL = import.meta.env.VITE_PLAY_STORE_URL ?? 'https://play.google.com/store'

export default function InviteLandingPage() {
  const { invitationId } = useParams()
  const [params] = useSearchParams()
  const email = params.get('email') ?? ''
  const club = params.get('club') ?? 'un club Rösti'

  const desktopUrl = `${SPA_URL}/register?invitationId=${invitationId ?? ''}&email=${encodeURIComponent(email)}&club=${encodeURIComponent(club)}`
  const deepLink = `rosti://invite?token=${invitationId ?? ''}&email=${encodeURIComponent(email)}`

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-lg space-y-6 text-center">
        <img src={RostiLogo} alt="" className="mx-auto h-14 w-14 rounded-lg object-contain" />
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Rösti</p>
        <h1 className="text-4xl font-semibold tracking-tight">Tu es invité·e à {club}</h1>
        <p className="text-muted-foreground">
          Installe l’app mobile, ou ouvre Rösti sur ordinateur pour créer ton compte
          {email ? ` avec ${email}` : ''}.
        </p>
        <div className="flex flex-col gap-3 items-center">
          <a className="underline" href={APP_STORE_URL}>
            App Store
          </a>
          <a className="underline" href={PLAY_STORE_URL}>
            Google Play
          </a>
          <a className="underline" href={deepLink}>
            Ouvrir l’app Rösti
          </a>
          <a className="rounded-md bg-primary px-4 py-2 text-primary-foreground" href={desktopUrl}>
            Continuer sur ordinateur
          </a>
        </div>
      </div>
    </main>
  )
}
