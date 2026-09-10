import { EmptyState } from '@pitchkit/ui/components/app'
import { Button } from '@pitchkit/ui/components/primitives/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@pitchkit/ui/components/primitives/dropdown-menu'
import { toast } from '@pitchkit/ui/components/primitives/sonner'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, MapPin, MoreVertical, Plus, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { useClub } from '@/features/clubs/club-context'
import { pitchkitApi, type Match } from '@/lib/pitchkit-api'
import { PostponeMatchDialog } from './postpone-match-dialog'

export default function MatchesPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { activeClub } = useClub()
  const queryClient = useQueryClient()
  const orgId = activeClub?.id
  const [postponeMatch, setPostponeMatch] = useState<Match | null>(null)

  const { data: matches = [], isLoading } = useQuery({
    queryKey: ['matches', orgId],
    queryFn: () => pitchkitApi.listMatches(orgId!),
    enabled: !!orgId,
  })

  const upcoming = useMemo(() => {
    const now = Date.now()
    return matches
      .filter((m) => m.status === 'scheduled' && new Date(m.startsAt).getTime() >= now)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
  }, [matches])

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['matches', orgId] })
  }

  const cancel = useMutation({
    mutationFn: (matchId: string) => pitchkitApi.cancelMatch(orgId!, matchId),
    onSuccess: () => {
      toast.success(t('matches.cancelSuccess'))
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const postpone = useMutation({
    mutationFn: ({ matchId, startsAt }: { matchId: string; startsAt: Date }) =>
      pitchkitApi.updateMatch(orgId!, matchId, { startsAt: startsAt.toISOString() }),
    onSuccess: () => {
      toast.success(t('matches.postponeSuccess'))
      setPostponeMatch(null)
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const dateLocale = i18n.language?.startsWith('en') ? 'en-GB' : 'fr-FR'

  if (!activeClub) {
    return <div className="p-6 text-muted-foreground">{t('matches.selectClub')}</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('matches.title')}</h1>
          <p className="text-sm text-muted-foreground">{activeClub.name}</p>
        </div>
        <Button render={<Link to="/matches/new" />}>
          <Plus className="size-4" />
          {t('matches.create')}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t('matches.loading')}</p>
      ) : upcoming.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="size-6 text-muted-foreground" />}
          title={t('matches.emptyTitle')}
          description={t('matches.emptyDescription')}
          action={{
            label: t('matches.create'),
            onClick: () => navigate('/matches/new'),
          }}
        />
      ) : (
        <ul className="grid gap-3">
          {upcoming.map((match) => (
            <li key={match.id}>
              <div className="relative rounded-xl border bg-card p-5 shadow-sm transition-colors hover:bg-accent/40">
                <Link
                  to={`/matches/${match.id}`}
                  className="absolute inset-0 rounded-xl"
                  aria-label={match.title}
                />
                <div className="relative z-10 flex items-start justify-between gap-3 pointer-events-none">
                  <div className="space-y-2 min-w-0">
                    <p className="font-medium text-lg truncate">{match.title}</p>
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarDays className="size-4 shrink-0" />
                      {new Date(match.startsAt).toLocaleString(dateLocale, {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    {match.location ? (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="size-4 shrink-0" />
                        {match.location}
                      </p>
                    ) : null}
                    <p
                      className={`flex items-center gap-2 text-sm ${
                        (match.presentCount ?? 0) >= match.maxCapacity
                          ? 'text-success'
                          : 'text-muted-foreground'
                      }`}
                    >
                      <Users className="size-4 shrink-0" />
                      {t('matches.capacity', {
                        present: match.presentCount ?? 0,
                        max: match.maxCapacity,
                      })}
                    </p>
                  </div>
                  <div className="pointer-events-auto shrink-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t('matches.menuOpen')}
                          />
                        }
                      >
                        <MoreVertical className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-44">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.preventDefault()
                            setPostponeMatch(match)
                          }}
                        >
                          {t('matches.postpone')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={(e) => {
                            e.preventDefault()
                            cancel.mutate(match.id)
                          }}
                        >
                          {t('matches.cancel')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {postponeMatch ? (
        <PostponeMatchDialog
          open={!!postponeMatch}
          onOpenChange={(open) => {
            if (!open) setPostponeMatch(null)
          }}
          currentStartsAt={postponeMatch.startsAt}
          isPending={postpone.isPending}
          onConfirm={(startsAt) =>
            postpone.mutate({ matchId: postponeMatch.id, startsAt })
          }
        />
      ) : null}
    </div>
  )
}
