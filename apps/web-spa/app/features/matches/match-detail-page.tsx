import { Button } from '@pitchkit/ui/components/primitives/button'
import { Input } from '@pitchkit/ui/components/primitives/input'
import { toast } from '@pitchkit/ui/components/primitives/sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@pitchkit/ui/components/primitives/tabs'
import { cn } from '@pitchkit/ui/lib/utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Clock, MapPin, Send } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { useClub } from '@/features/clubs/club-context'
import { authClient } from '@/lib/auth-client'
import {
  pitchkitApi,
  type Attendance,
  type Lineup,
  type MatchMessage,
  type MatchStat,
} from '@/lib/pitchkit-api'
import { LineupDialog } from './lineup-dialog'

type MatchTab = 'summary' | 'attendance' | 'chat' | 'stats'

interface PlayerStatDraft {
  goals: number
  assists: number
}

export default function MatchDetailPage() {
  const { matchId } = useParams()
  const { t, i18n } = useTranslation()
  const { activeClub, isClubAdmin } = useClub()
  const orgId = activeClub?.id
  const queryClient = useQueryClient()
  const { data: session } = authClient.useSession()
  const [tab, setTab] = useState<MatchTab>('summary')
  const [message, setMessage] = useState('')
  const [statDrafts, setStatDrafts] = useState<Record<string, PlayerStatDraft>>({})
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [isLineupOpen, setIsLineupOpen] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const dateLocale = i18n.language?.startsWith('en') ? 'en-GB' : 'fr-FR'

  const enabled = !!orgId && !!matchId

  const { data: match, isLoading } = useQuery({
    queryKey: ['match', orgId, matchId],
    queryFn: () => pitchkitApi.getMatch(orgId!, matchId!),
    enabled,
  })

  const { data: attendances = [] } = useQuery({
    queryKey: ['attendances', orgId, matchId],
    queryFn: () => pitchkitApi.listAttendances(orgId!, matchId!),
    enabled,
  })

  const { data: lineups = [] } = useQuery({
    queryKey: ['lineups', orgId, matchId],
    queryFn: () => pitchkitApi.listLineups(orgId!, matchId!),
    enabled,
  })

  const { data: messages = [] } = useQuery({
    queryKey: ['messages', orgId, matchId],
    queryFn: () => pitchkitApi.listMessages(orgId!, matchId!),
    enabled,
  })

  const { data: stats = [] } = useQuery({
    queryKey: ['match-stats', orgId, matchId],
    queryFn: () => pitchkitApi.listMatchStats(orgId!, matchId!),
    enabled,
  })

  const myAttendance = useMemo(
    () => attendances.find((a) => a.userId === session?.user?.id),
    [attendances, session?.user?.id],
  )

  const presentPlayers = useMemo(
    () => attendances.filter((a) => a.status === 'present'),
    [attendances],
  )

  const attendanceGroups = useMemo(
    () => ({
      present: attendances.filter((a) => a.status === 'present'),
      pending: attendances.filter((a) => a.status === 'pending'),
      absent: attendances.filter((a) => a.status === 'absent'),
    }),
    [attendances],
  )

  useEffect(() => {
    const next: Record<string, PlayerStatDraft> = {}
    for (const player of presentPlayers) {
      const existing = stats.find((s) => s.userId === player.userId)
      next[player.userId] = {
        goals: existing?.goals ?? 0,
        assists: existing?.assists ?? 0,
      }
    }
    setStatDrafts(next)
  }, [presentPlayers, stats])

  useEffect(() => {
    if (tab !== 'chat') return
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, tab])

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['attendances', orgId, matchId] })
    void queryClient.invalidateQueries({ queryKey: ['match', orgId, matchId] })
    void queryClient.invalidateQueries({ queryKey: ['matches', orgId] })
    void queryClient.invalidateQueries({ queryKey: ['lineups', orgId, matchId] })
    void queryClient.invalidateQueries({ queryKey: ['messages', orgId, matchId] })
    void queryClient.invalidateQueries({ queryKey: ['match-stats', orgId, matchId] })
  }

  const rsvp = useMutation({
    mutationFn: (status: 'present' | 'absent') =>
      pitchkitApi.respondAttendance(orgId!, matchId!, status),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  })

  const cancel = useMutation({
    mutationFn: () => pitchkitApi.cancelMatch(orgId!, matchId!),
    onSuccess: () => {
      toast.success(t('matches.cancelSuccess'))
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const saveLineup = useMutation({
    mutationFn: (assignments: Array<{ userId: string; team: 'blue' | 'red' }>) =>
      pitchkitApi.setLineup(orgId!, matchId!, assignments),
    onSuccess: () => {
      toast.success(t('matches.detail.lineupEditor.saved'))
      setIsLineupOpen(false)
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const setAttendance = useMutation({
    mutationFn: ({
      userId,
      status,
    }: {
      userId: string
      status: 'present' | 'absent' | 'pending'
    }) => pitchkitApi.setAttendance(orgId!, matchId!, userId, status),
    onMutate: ({ userId }) => setBusyUserId(userId),
    onSettled: () => setBusyUserId(null),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  })

  const sortedAttendances = useMemo(
    () =>
      [...attendances].sort((a, b) =>
        a.userName.localeCompare(b.userName, dateLocale, { sensitivity: 'base' }),
      ),
    [attendances, dateLocale],
  )

  const postMsg = useMutation({
    mutationFn: () => pitchkitApi.postMessage(orgId!, matchId!, message.trim()),
    onSuccess: () => {
      setMessage('')
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const saveStats = useMutation({
    mutationFn: () =>
      pitchkitApi.upsertMatchStats(
        orgId!,
        matchId!,
        presentPlayers.map((a) => ({
          userId: a.userId,
          goals: statDrafts[a.userId]?.goals ?? 0,
          assists: statDrafts[a.userId]?.assists ?? 0,
        })),
      ),
    onSuccess: () => {
      toast.success(t('matches.detail.stats.saved'))
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const teamScore = useMemo(
    () => computeTeamScore(lineups, presentPlayers, statDrafts, stats),
    [lineups, presentPlayers, statDrafts, stats],
  )

  if (isLoading || !match) {
    return <div className="text-muted-foreground">{t('matches.detail.loading')}</div>
  }

  const startsAt = new Date(match.startsAt)
  const dateLabel = startsAt.toLocaleDateString(dateLocale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const timeLabel = startsAt.toLocaleTimeString(dateLocale, {
    hour: '2-digit',
    minute: '2-digit',
  })
  const canRsvp = match.status === 'scheduled'
  const isChat = tab === 'chat'
  const canManageComposition = isClubAdmin && match.status !== 'cancelled'

  return (
    <div className={cn('flex flex-col', isChat && '-m-6 h-[calc(100dvh-var(--header-height))]')}>
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as MatchTab)}
        className={cn('w-full min-h-0 flex-col gap-0', isChat && 'flex-1')}
      >
        <div className={cn('shrink-0 space-y-4', isChat && 'border-b px-6 pt-6 pb-3')}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{match.title}</h1>
              <p className="text-sm text-muted-foreground">
                {t(`matches.detail.status.${match.status}`)}
              </p>
            </div>
            {match.status === 'scheduled' ? (
              <Button variant="destructive" onClick={() => cancel.mutate()}>
                {t('matches.cancel')}
              </Button>
            ) : null}
          </div>

          <TabsList className="h-9 w-full justify-start gap-1 rounded-lg border border-border bg-muted p-1">
            <TabsTrigger value="summary" className="px-3">
              {t('matches.detail.tabs.summary')}
            </TabsTrigger>
            <TabsTrigger value="attendance" className="px-3">
              {t('matches.detail.tabs.attendance')}
            </TabsTrigger>
            <TabsTrigger value="chat" className="px-3">
              {t('matches.detail.tabs.chat')}
            </TabsTrigger>
            <TabsTrigger value="stats" className="px-3">
              {t('matches.detail.tabs.stats')}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="summary"
          className={cn('mt-6 space-y-6 outline-none', isChat && 'px-6')}
        >
          <dl className="grid gap-4 sm:grid-cols-3">
            <InfoItem
              icon={<CalendarDays className="size-4" />}
              label={t('matches.detail.summary.date')}
              value={dateLabel}
            />
            <InfoItem
              icon={<Clock className="size-4" />}
              label={t('matches.detail.summary.time')}
              value={timeLabel}
            />
            <InfoItem
              icon={<MapPin className="size-4" />}
              label={t('matches.detail.summary.location')}
              value={match.location ?? t('matches.detail.noLocation')}
            />
          </dl>

          {canRsvp ? (
            <section className="space-y-3">
              <p className="text-sm font-medium">{t('matches.detail.rsvp.question')}</p>
              <RsvpButtons
                status={myAttendance?.status}
                disabled={rsvp.isPending}
                onPresent={() => rsvp.mutate('present')}
                onAbsent={() => rsvp.mutate('absent')}
                presentLabel={t('matches.detail.rsvp.present')}
                absentLabel={t('matches.detail.rsvp.absent')}
              />
            </section>
          ) : null}

          <AttendanceGroup
            title={t('matches.detail.summary.presentPlayers')}
            players={presentPlayers}
            emptyLabel={t('matches.detail.summary.noPresent')}
          />

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-medium">{t('matches.detail.summary.lineup')}</h2>
              {canManageComposition ? (
                <Button size="sm" variant="outline" onClick={() => setIsLineupOpen(true)}>
                  {t(
                    lineups.length === 0
                      ? 'matches.detail.lineupEditor.create'
                      : 'matches.detail.lineupEditor.edit',
                  )}
                </Button>
              ) : null}
            </div>
            <LineupSection
              lineups={lineups}
              blueLabel={t('matches.detail.summary.teamBlue')}
              redLabel={t('matches.detail.summary.teamRed')}
              emptyLabel={t('matches.detail.summary.noLineup')}
            />
          </section>
        </TabsContent>

        <TabsContent
          value="attendance"
          className={cn('mt-6 space-y-6 outline-none', isChat && 'px-6')}
        >
          {canManageComposition ? (
            <AttendanceManager
              players={sortedAttendances}
              busyUserId={busyUserId}
              onSetStatus={(userId, status) => setAttendance.mutate({ userId, status })}
              labels={{
                hint: t('matches.detail.attendance.manageHint'),
                present: t('matches.detail.attendance.markPresent'),
                absent: t('matches.detail.attendance.markAbsent'),
                pending: t('matches.detail.attendance.markPending'),
                empty: t('matches.detail.attendance.empty'),
              }}
            />
          ) : (
            <>
              <AttendanceGroup
                title={t('matches.detail.attendance.present')}
                players={attendanceGroups.present}
                emptyLabel={t('matches.detail.attendance.empty')}
              />
              <AttendanceGroup
                title={t('matches.detail.attendance.pending')}
                players={attendanceGroups.pending}
                emptyLabel={t('matches.detail.attendance.empty')}
              />
              <AttendanceGroup
                title={t('matches.detail.attendance.absent')}
                players={attendanceGroups.absent}
                emptyLabel={t('matches.detail.attendance.empty')}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="chat" className="flex min-h-0 flex-1 flex-col outline-none">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-4">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('matches.detail.chat.empty')}</p>
            ) : (
              messages.map((msg) => (
                <ChatBubble
                  key={msg.id}
                  message={msg}
                  isMine={msg.authorId === session?.user?.id}
                />
              ))
            )}
            <div ref={chatEndRef} />
          </div>
          <form
            className="flex shrink-0 gap-2 border-t bg-background p-3 px-6"
            onSubmit={(event) => {
              event.preventDefault()
              if (!message.trim() || postMsg.isPending) return
              postMsg.mutate()
            }}
          >
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('matches.detail.chat.placeholder')}
              className="flex-1"
              autoComplete="off"
            />
            <Button type="submit" disabled={!message.trim() || postMsg.isPending} size="icon">
              <Send className="size-4" />
              <span className="sr-only">{t('matches.detail.chat.send')}</span>
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="stats" className={cn('mt-6 space-y-6 outline-none', isChat && 'px-6')}>
          <section className="space-y-2">
            <h2 className="text-base font-medium">{t('matches.detail.stats.score')}</h2>
            <div className="flex items-center justify-center gap-6 rounded-lg border px-6 py-8">
              <div className="text-center">
                <p className="text-sm font-medium text-blue-600">
                  {t('matches.detail.stats.teamBlue')}
                </p>
                <p className="text-4xl font-semibold tabular-nums">{teamScore.blue}</p>
              </div>
              <span className="text-2xl text-muted-foreground">–</span>
              <div className="text-center">
                <p className="text-sm font-medium text-red-600">
                  {t('matches.detail.stats.teamRed')}
                </p>
                <p className="text-4xl font-semibold tabular-nums">{teamScore.red}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t('matches.detail.stats.hint')}</p>
          </section>

          {presentPlayers.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('matches.detail.stats.noPlayers')}</p>
          ) : (
            <section className="space-y-3">
              <div className="grid grid-cols-[1fr_5rem_5rem] gap-2 px-1 text-xs font-medium text-muted-foreground">
                <span>{t('matches.detail.stats.player')}</span>
                <span className="text-center">{t('matches.detail.stats.goals')}</span>
                <span className="text-center">{t('matches.detail.stats.assists')}</span>
              </div>
              <ul className="space-y-2">
                {presentPlayers.map((player) => (
                  <li
                    key={player.userId}
                    className="grid grid-cols-[1fr_5rem_5rem] items-center gap-2"
                  >
                    <span className="truncate text-sm">{player.userName}</span>
                    <Input
                      type="number"
                      min={0}
                      className="text-center"
                      value={statDrafts[player.userId]?.goals ?? 0}
                      onChange={(e) =>
                        setStatDrafts((prev) => ({
                          ...prev,
                          [player.userId]: {
                            goals: Number(e.target.value) || 0,
                            assists: prev[player.userId]?.assists ?? 0,
                          },
                        }))
                      }
                    />
                    <Input
                      type="number"
                      min={0}
                      className="text-center"
                      value={statDrafts[player.userId]?.assists ?? 0}
                      onChange={(e) =>
                        setStatDrafts((prev) => ({
                          ...prev,
                          [player.userId]: {
                            goals: prev[player.userId]?.goals ?? 0,
                            assists: Number(e.target.value) || 0,
                          },
                        }))
                      }
                    />
                  </li>
                ))}
              </ul>
              <Button onClick={() => saveStats.mutate()} disabled={saveStats.isPending}>
                {t('matches.detail.stats.save')}
              </Button>
            </section>
          )}
        </TabsContent>
      </Tabs>
      <LineupDialog
        open={isLineupOpen}
        onOpenChange={setIsLineupOpen}
        presentPlayers={presentPlayers}
        lineups={lineups}
        sportType={activeClub?.sportType}
        isPending={saveLineup.isPending}
        onSave={(assignments) => saveLineup.mutate(assignments)}
      />
    </div>
  )
}

function RsvpButtons({
  status,
  disabled,
  onPresent,
  onAbsent,
  presentLabel,
  absentLabel,
}: {
  status?: Attendance['status']
  disabled?: boolean
  onPresent: () => void
  onAbsent: () => void
  presentLabel: string
  absentLabel: string
}) {
  const hasAnswered = status === 'present' || status === 'absent'

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant={status === 'present' ? 'default' : 'outline'}
        className={cn(
          'min-w-36',
          hasAnswered && status !== 'present' && 'opacity-40 hover:opacity-70',
        )}
        disabled={disabled}
        onClick={onPresent}
      >
        {presentLabel}
      </Button>
      <Button
        type="button"
        variant={status === 'absent' ? 'default' : 'outline'}
        className={cn(
          'min-w-36',
          hasAnswered && status !== 'absent' && 'opacity-40 hover:opacity-70',
        )}
        disabled={disabled}
        onClick={onAbsent}
      >
        {absentLabel}
      </Button>
    </div>
  )
}

function InfoItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="space-y-1 rounded-lg border p-3">
      <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  )
}

function AttendanceGroup({
  title,
  players,
  emptyLabel,
}: {
  title: string
  players: Attendance[]
  emptyLabel: string
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-medium">
        {title} <span className="text-muted-foreground">({players.length})</span>
      </h2>
      {players.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {players.map((player) => (
            <li key={player.id} className="px-3 py-2 text-sm">
              {player.userName}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function AttendanceManager({
  players,
  busyUserId,
  onSetStatus,
  labels,
}: {
  players: Attendance[]
  busyUserId: string | null
  onSetStatus: (userId: string, status: 'present' | 'absent' | 'pending') => void
  labels: {
    hint: string
    present: string
    absent: string
    pending: string
    empty: string
  }
}) {
  if (players.length === 0) {
    return <p className="text-sm text-muted-foreground">{labels.empty}</p>
  }

  return (
    <section className="space-y-4">
      <p className="text-sm text-muted-foreground">{labels.hint}</p>
      <ul className="divide-y rounded-lg border">
        {players.map((player) => {
          const busy = busyUserId === player.userId
          return (
            <li
              key={player.id}
              className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{player.userName}</p>
              </div>
              <div className="flex flex-wrap gap-1 sm:justify-end">
                <ToggleChip
                  active={player.status === 'present'}
                  disabled={busy}
                  onClick={() => onSetStatus(player.userId, 'present')}
                  label={labels.present}
                />
                <ToggleChip
                  active={player.status === 'absent'}
                  disabled={busy}
                  onClick={() => onSetStatus(player.userId, 'absent')}
                  label={labels.absent}
                />
                <ToggleChip
                  active={player.status === 'pending'}
                  disabled={busy}
                  onClick={() => onSetStatus(player.userId, 'pending')}
                  label={labels.pending}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function ToggleChip({
  active,
  disabled,
  onClick,
  label,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  label: string
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? 'default' : 'outline'}
      disabled={disabled}
      onClick={onClick}
      className="h-7 px-2.5 text-xs"
    >
      {label}
    </Button>
  )
}

function LineupSection({
  lineups,
  title,
  blueLabel,
  redLabel,
  emptyLabel,
}: {
  lineups: Lineup[]
  title?: string
  blueLabel: string
  redLabel: string
  emptyLabel: string
}) {
  const blue = lineups.filter((l) => l.team === 'blue')
  const red = lineups.filter((l) => l.team === 'red')

  if (lineups.length === 0) {
    return (
      <section className="space-y-2">
        {title ? <h2 className="text-base font-medium">{title}</h2> : null}
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      </section>
    )
  }

  return (
    <section className="space-y-3">
      {title ? <h2 className="text-base font-medium">{title}</h2> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border p-3">
          <h3 className="mb-2 text-sm font-medium text-blue-600">{blueLabel}</h3>
          <ul className="space-y-1 text-sm">
            {blue.map((l) => (
              <li key={l.id}>{l.userName}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border p-3">
          <h3 className="mb-2 text-sm font-medium text-red-600">{redLabel}</h3>
          <ul className="space-y-1 text-sm">
            {red.map((l) => (
              <li key={l.id}>{l.userName}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

function ChatBubble({ message, isMine }: { message: MatchMessage; isMine: boolean }) {
  return (
    <div className={cn('flex flex-col gap-0.5', isMine ? 'items-end' : 'items-start')}>
      {!isMine ? (
        <span className="px-1 text-xs font-medium text-muted-foreground">{message.authorName}</span>
      ) : null}
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3 py-2 text-sm',
          isMine ? 'bg-primary text-primary-foreground' : 'bg-muted',
        )}
      >
        {message.body}
      </div>
    </div>
  )
}

function computeTeamScore(
  lineups: Lineup[],
  presentPlayers: Attendance[],
  drafts: Record<string, PlayerStatDraft>,
  stats: MatchStat[],
): { blue: number; red: number } {
  const teamByUser = new Map(lineups.map((l) => [l.userId, l.team]))

  let blue = 0
  let red = 0

  for (const player of presentPlayers) {
    const goals =
      drafts[player.userId]?.goals ?? stats.find((s) => s.userId === player.userId)?.goals ?? 0
    const team = teamByUser.get(player.userId)
    if (team === 'blue') blue += goals
    else if (team === 'red') red += goals
  }

  return { blue, red }
}
