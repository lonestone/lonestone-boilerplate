import { Button } from '@pitchkit/ui/components/primitives/button'
import { DatePicker } from '@pitchkit/ui/components/primitives/date-picker'
import { Input } from '@pitchkit/ui/components/primitives/input'
import { Label } from '@pitchkit/ui/components/primitives/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pitchkit/ui/components/primitives/select'
import { toast } from '@pitchkit/ui/components/primitives/sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate } from 'react-router'
import { useClub } from '@/features/clubs/club-context'
import { pitchkitApi } from '@/lib/pitchkit-api'
import {
  combineDateAndTime,
  defaultNextMatchDate,
  getNthWeekdayLabel,
  type RecurrenceChoice,
  TIME_OPTIONS,
} from './match-schedule-utils'

export default function CreateMatchPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { activeClub } = useClub()

  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [maxPlayers, setMaxPlayers] = useState(10)
  const [defaultsReady, setDefaultsReady] = useState(false)
  const [matchDate, setMatchDate] = useState<Date | undefined>(() => defaultNextMatchDate())
  const [matchTime, setMatchTime] = useState('19:00')
  const [recurrence, setRecurrence] = useState<RecurrenceChoice>('weekly')

  useEffect(() => {
    if (!activeClub || defaultsReady) return
    setTitle(t('createMatch.defaultTitle', { club: activeClub.name }))
    setLocation(activeClub.venue ?? '')
    setMaxPlayers(activeClub.defaultMaxCapacity ?? 10)
    setDefaultsReady(true)
  }, [activeClub, defaultsReady, t])

  const weekdayName = useMemo(
    () => (matchDate ? matchDate.toLocaleDateString('fr-FR', { weekday: 'long' }) : ''),
    [matchDate],
  )
  const dayOfMonth = matchDate?.getDate() ?? 1

  const create = useMutation({
    mutationFn: async () => {
      if (!activeClub) throw new Error(t('createMatch.errors.missingClub'))
      if (!matchDate || !title.trim()) throw new Error(t('createMatch.errors.requiredFields'))
      if (maxPlayers < 2) throw new Error(t('createMatch.errors.maxPlayers'))

      const seasons = await pitchkitApi.listSeasons(activeClub.id)
      let seasonId = seasons.find((s) => s.status === 'active')?.id
      if (!seasonId) {
        const year = new Date().getFullYear()
        const season = await pitchkitApi.createSeason(activeClub.id, {
          name: t('createMatch.seasonName', { year }),
          startsAt: new Date().toISOString().slice(0, 10),
        })
        seasonId = season.id
      }

      const startsAt = combineDateAndTime(matchDate, matchTime)
      await pitchkitApi.createMatches(activeClub.id, {
        seasonId,
        title: title.trim(),
        startsAt: startsAt.toISOString(),
        location: location.trim() || undefined,
        maxCapacity: maxPlayers,
        reminderOffsetsHours: [120, 48],
        recurrence:
          recurrence === 'once'
            ? undefined
            : {
                frequency: recurrence,
                occurrenceCount: 12,
              },
      })
    },
    onSuccess: () => {
      toast.success(t('createMatch.success'))
      void queryClient.invalidateQueries({ queryKey: ['matches', activeClub?.id] })
      navigate('/matches')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (!activeClub) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-8">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" className="-ml-2" render={<Link to="/matches" />}>
          ← {t('createMatch.back')}
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">{t('createMatch.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('createMatch.subtitle', { club: activeClub.name })}
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="matchTitle">{t('createMatch.matchTitle')}</Label>
          <Input
            id="matchTitle"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('createMatch.matchTitlePlaceholder')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">{t('createMatch.location')}</Label>
          <Input
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={t('createMatch.locationPlaceholder')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="maxPlayers">{t('createMatch.maxPlayers')}</Label>
          <Input
            id="maxPlayers"
            type="number"
            min={2}
            max={40}
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(Number(e.target.value) || 0)}
          />
        </div>

        <div className="space-y-2">
          <Label>{t('createMatch.date')}</Label>
          <DatePicker
            value={matchDate}
            onDateChange={setMatchDate}
            localeCode="fr-FR"
            placeholder={t('createMatch.datePlaceholder')}
          />
        </div>

        <div className="space-y-2">
          <Label>{t('createMatch.time')}</Label>
          <Select value={matchTime} onValueChange={(v) => v && setMatchTime(v)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_OPTIONS.map((time) => (
                <SelectItem key={time} value={time}>
                  {time}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t('createMatch.recurrence')}</Label>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant={recurrence === 'once' ? 'default' : 'outline'}
              className="justify-start h-auto py-3"
              onClick={() => setRecurrence('once')}
            >
              {t('createMatch.once')}
            </Button>
            <Button
              type="button"
              variant={recurrence === 'weekly' ? 'default' : 'outline'}
              className="justify-start h-auto py-3"
              onClick={() => setRecurrence('weekly')}
            >
              {t('createMatch.everyWeek', { day: weekdayName })}
            </Button>
            <Button
              type="button"
              variant={recurrence === 'monthly_nth_weekday' ? 'default' : 'outline'}
              className="justify-start h-auto py-3"
              onClick={() => setRecurrence('monthly_nth_weekday')}
            >
              {matchDate
                ? getNthWeekdayLabel(matchDate, t, 'createMatch')
                : t('createMatch.monthlyNthFallback')}
            </Button>
            <Button
              type="button"
              variant={recurrence === 'monthly' ? 'default' : 'outline'}
              className="justify-start h-auto py-3"
              onClick={() => setRecurrence('monthly')}
            >
              {t('createMatch.everyMonthDate', { day: dayOfMonth })}
            </Button>
          </div>
          {recurrence !== 'once' ? (
            <p className="text-xs text-muted-foreground">{t('createMatch.recurrenceHint')}</p>
          ) : null}
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" render={<Link to="/matches" />}>
            {t('createMatch.back')}
          </Button>
          <Button
            className="flex-1"
            disabled={create.isPending || !matchDate || !title.trim() || maxPlayers < 2}
            onClick={() => create.mutate()}
          >
            {create.isPending ? t('createMatch.submitting') : t('createMatch.submit')}
          </Button>
        </div>
      </div>
    </div>
  )
}
