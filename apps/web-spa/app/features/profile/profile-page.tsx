import { Avatar, AvatarFallback } from '@boilerstone/ui/components/primitives/avatar'
import { useTranslation } from 'react-i18next'
import { authClient } from '@/lib/auth-client'

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background p-5">
      <dt className="mb-1 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm font-medium text-foreground break-words">{value}</dd>
    </div>
  )
}

export default function ProfilePage() {
  const { t } = useTranslation()
  const { data: sessionData } = authClient.useSession()
  const user = sessionData?.user

  const name = user?.name ?? user?.email ?? 'User'
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-border pb-6">
        <p className="mb-1 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
          {t('profile.eyebrow')}
        </p>
        <h1 className="font-sans text-3xl font-black tracking-tight text-foreground">
          {t('profile.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('profile.description')}</p>
      </div>

      {/* Identity */}
      <div className="flex items-center gap-4">
        <Avatar size="lg" className="size-16">
          <AvatarFallback className="text-lg font-bold">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-foreground">{name}</p>
          <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      {/* Details */}
      <dl className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
        <Field label={t('profile.name')} value={user?.name ?? '—'} />
        <Field label={t('profile.email')} value={user?.email ?? '—'} />
        <Field
          label={t('profile.emailVerified')}
          value={user?.emailVerified ? t('profile.verified') : t('profile.unverified')}
        />
        <Field label={t('profile.userId')} value={user?.id ?? '—'} />
      </dl>
    </div>
  )
}
