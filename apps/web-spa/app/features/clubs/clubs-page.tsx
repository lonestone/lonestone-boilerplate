import { Button } from '@pitchkit/ui/components/primitives/button'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, MapPin, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate } from 'react-router'
import { pitchkitApi } from '@/lib/pitchkit-api'
import { useClub } from './club-context'

export default function ClubsPage() {
  const { t, i18n } = useTranslation()
  const { clubs, activeClub, isLoading, isClubAdmin } = useClub()

  const { data: matches = [], isLoading: isMatchesLoading } = useQuery({
    queryKey: ['matches', activeClub?.id, 'dashboard'],
    queryFn: () => pitchkitApi.listMatches(activeClub!.id),
    enabled: !!activeClub,
  })

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">{t('common.loading')}</div>
  }

  if (clubs.length === 0) {
    return <Navigate to="/onboarding" replace />
  }

  const nextMatch = matches
    .filter((m) => m.status === 'scheduled' && new Date(m.startsAt) >= new Date())
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0]

  const dateLocale = i18n.language?.startsWith('en') ? 'en-GB' : 'fr-FR'

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">{t('home.eyebrow')}</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {activeClub?.name ?? t('home.fallbackClub')}
        </h1>
        {activeClub?.venue ? (
          <p className="mt-2 flex items-center gap-2 text-muted-foreground">
            <MapPin className="size-4 shrink-0" />
            {activeClub.venue}
          </p>
        ) : null}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">{t('home.nextMatch')}</h2>
        {isMatchesLoading ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : nextMatch ? (
          <Link
            to={`/matches/${nextMatch.id}`}
            className="block rounded-xl border bg-card p-5 shadow-sm transition-colors hover:bg-accent/40"
          >
            <div className="space-y-2">
              <p className="font-medium text-lg">{nextMatch.title}</p>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="size-4 shrink-0" />
                {new Date(nextMatch.startsAt).toLocaleString(dateLocale, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              {nextMatch.location ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="size-4 shrink-0" />
                  {nextMatch.location}
                </p>
              ) : null}
              <p
                className={`flex items-center gap-2 text-sm ${
                  (nextMatch.presentCount ?? 0) >= nextMatch.maxCapacity
                    ? 'text-success'
                    : 'text-muted-foreground'
                }`}
              >
                <Users className="size-4 shrink-0" />
                {t('home.capacity', {
                  present: nextMatch.presentCount ?? 0,
                  max: nextMatch.maxCapacity,
                })}
              </p>
            </div>
          </Link>
        ) : (
          <div className="rounded-xl border border-dashed p-6 text-center space-y-3">
            <p className="text-muted-foreground">{t('home.noUpcoming')}</p>
            <Button variant="outline" render={<Link to="/matches" />}>
              {t('home.goToMatches')}
            </Button>
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" render={<Link to="/matches" />}>
          {t('home.allMatches')}
        </Button>
        {isClubAdmin ? (
          <Button variant="outline" render={<Link to="/club-settings" />}>
            {t('nav.clubSettings')}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
