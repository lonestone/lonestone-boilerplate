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
import { AppLoader } from '@pitchkit/ui/components/app'
import { cn } from '@pitchkit/ui/lib/utils'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate } from 'react-router'
import { acceptPendingInvitations } from '@/features/auth/utils/pending-invitation'
import { authClient } from '@/lib/auth-client'
import { pitchkitApi, type SportType } from '@/lib/pitchkit-api'
import { EmailPillsInput } from './email-pills-input'

const SPORTS: SportType[] = [
  'football',
  'futsal',
  'basketball',
  'volleyball',
  'tennis',
  'padel',
  'badminton',
  'other',
]

type RecurrenceChoice = 'weekly' | 'monthly_nth_weekday' | 'monthly'

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2)
  const m = i % 2 === 0 ? '00' : '30'
  return `${String(h).padStart(2, '0')}:${m}`
})

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function combineDateAndTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number)
  const next = new Date(date)
  next.setHours(hours ?? 19, minutes ?? 0, 0, 0)
  return next
}

function getNthWeekdayLabel(
  date: Date,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const nth = Math.floor((date.getDate() - 1) / 7) + 1
  const day = date.toLocaleDateString('fr-FR', { weekday: 'long' })
  const ordinals = ['', '1ers', '2es', '3es', '4es', '5es']
  return t('onboarding.step3.everyNthWeekday', {
    ordinal: ordinals[nth] ?? `${nth}es`,
    day,
  })
}

export default function OnboardingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: session, isPending: isSessionPending } = authClient.useSession()
  const [step, setStep] = useState(1)
  const [clubId, setClubId] = useState<string | null>(null)
  const [clubName, setClubName] = useState('')
  const [venue, setVenue] = useState('')
  const [sportType, setSportType] = useState<SportType>('football')
  const [maxPlayers, setMaxPlayers] = useState(10)
  const [matchDate, setMatchDate] = useState<Date | undefined>(() => {
    const d = new Date()
    d.setDate(d.getDate() + ((1 + 7 - d.getDay()) % 7 || 7))
    return d
  })
  const [matchTime, setMatchTime] = useState('19:00')
  const [recurrence, setRecurrence] = useState<RecurrenceChoice>('weekly')
  const [emails, setEmails] = useState<string[]>([])

  const { data: existingClubs, isLoading: isClubsLoading } = useQuery({
    queryKey: ['clubs', session?.user?.id, 'onboarding-gate'],
    queryFn: async () => {
      await acceptPendingInvitations()
      return pitchkitApi.listClubs()
    },
    enabled: !!session?.user && !clubId,
  })

  const weekdayName = useMemo(
    () => (matchDate ? matchDate.toLocaleDateString('fr-FR', { weekday: 'long' }) : ''),
    [matchDate],
  )

  const dayOfMonth = matchDate?.getDate() ?? 1

  const step1 = useMutation({
    mutationFn: async () => {
      const name = clubName.trim()
      if (!name || !venue.trim()) throw new Error(t('onboarding.errors.requiredFields'))
      const slug = slugify(name) || `club-${Date.now()}`
      const result = await authClient.organization.create({ name, slug })
      if (result.error) throw new Error(result.error.message)
      const id = result.data?.id
      if (!id) throw new Error(t('onboarding.errors.createClub'))
      await pitchkitApi.updateClub(id, { venue: venue.trim() })
      await authClient.organization.setActive({ organizationId: id })
      localStorage.setItem('pitchkit.activeClubId', id)
      return id
    },
    onSuccess: (id) => {
      setClubId(id)
      setStep(2)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const step2 = useMutation({
    mutationFn: async () => {
      if (!clubId) throw new Error(t('onboarding.errors.missingClub'))
      if (maxPlayers < 2) throw new Error(t('onboarding.errors.maxPlayers'))
      await pitchkitApi.updateClub(clubId, {
        sportType,
        defaultMaxCapacity: maxPlayers,
      })
    },
    onSuccess: () => setStep(3),
    onError: (err: Error) => toast.error(err.message),
  })

  const step3 = useMutation({
    mutationFn: async () => {
      if (!clubId || !matchDate) throw new Error(t('onboarding.errors.requiredFields'))
      const seasons = await pitchkitApi.listSeasons(clubId)
      let seasonId = seasons.find((s) => s.status === 'active')?.id
      if (!seasonId) {
        const year = new Date().getFullYear()
        const season = await pitchkitApi.createSeason(clubId, {
          name: t('onboarding.step3.seasonName', { year }),
          startsAt: new Date().toISOString().slice(0, 10),
        })
        seasonId = season.id
      }
      const startsAt = combineDateAndTime(matchDate, matchTime)
      await pitchkitApi.createMatches(clubId, {
        seasonId,
        title: t('onboarding.step3.matchTitle', { club: clubName }),
        startsAt: startsAt.toISOString(),
        location: venue.trim(),
        maxCapacity: maxPlayers,
        recurrence: {
          frequency: recurrence,
          occurrenceCount: 12,
        },
      })
    },
    onSuccess: () => setStep(4),
    onError: (err: Error) => toast.error(err.message),
  })

  const step4 = useMutation({
    mutationFn: async () => {
      if (!clubId) throw new Error(t('onboarding.errors.missingClub'))
      for (const email of emails) {
        const result = await authClient.organization.inviteMember({
          email,
          role: 'member',
          organizationId: clubId,
        })
        if (result.error) throw new Error(result.error.message)
      }
    },
    onSuccess: () => {
      toast.success(t('onboarding.done'))
      navigate('/dashboard')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const isPending =
    step1.isPending || step2.isPending || step3.isPending || step4.isPending

  if (isSessionPending || (session && isClubsLoading && !clubId)) {
    return <AppLoader />
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (!clubId && existingClubs && existingClubs.length > 0) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-8 py-4">
      <div className="space-y-2 text-center">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Rösti
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{t('onboarding.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('onboarding.stepOf', { current: step, total: 4 })}
        </p>
        <div className="flex justify-center gap-2 pt-2">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className={cn(
                'h-1.5 w-10 rounded-full',
                n <= step ? 'bg-primary' : 'bg-muted',
              )}
            />
          ))}
        </div>
      </div>

      {step === 1 ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clubName">{t('onboarding.step1.clubName')}</Label>
            <Input
              id="clubName"
              value={clubName}
              onChange={(e) => setClubName(e.target.value)}
              placeholder={t('onboarding.step1.clubNamePlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="venue">{t('onboarding.step1.venue')}</Label>
            <Input
              id="venue"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder={t('onboarding.step1.venuePlaceholder')}
            />
          </div>
          <Button
            className="w-full"
            disabled={isPending || !clubName.trim() || !venue.trim()}
            onClick={() => step1.mutate()}
          >
            {t('onboarding.next')}
          </Button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('onboarding.step2.sport')}</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SPORTS.map((sport) => (
                <Button
                  key={sport}
                  type="button"
                  variant={sportType === sport ? 'default' : 'outline'}
                  className="h-auto py-3"
                  onClick={() => setSportType(sport)}
                >
                  {t(`onboarding.sports.${sport}`)}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxPlayers">{t('onboarding.step2.maxPlayers')}</Label>
            <Input
              id="maxPlayers"
              type="number"
              min={2}
              max={40}
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value) || 0)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
              {t('onboarding.back')}
            </Button>
            <Button
              className="flex-1"
              disabled={isPending || maxPlayers < 2}
              onClick={() => step2.mutate()}
            >
              {t('onboarding.next')}
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('onboarding.step3.date')}</Label>
            <DatePicker
              value={matchDate}
              onDateChange={setMatchDate}
              localeCode="fr-FR"
              placeholder={t('onboarding.step3.datePlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('onboarding.step3.time')}</Label>
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
            <Label>{t('onboarding.step3.recurrence')}</Label>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant={recurrence === 'weekly' ? 'default' : 'outline'}
                className="justify-start h-auto py-3"
                onClick={() => setRecurrence('weekly')}
              >
                {t('onboarding.step3.everyWeek', { day: weekdayName })}
              </Button>
              <Button
                type="button"
                variant={recurrence === 'monthly_nth_weekday' ? 'default' : 'outline'}
                className="justify-start h-auto py-3"
                onClick={() => setRecurrence('monthly_nth_weekday')}
              >
                {matchDate
                  ? getNthWeekdayLabel(matchDate, t)
                  : t('onboarding.step3.monthlyNthFallback')}
              </Button>
              <Button
                type="button"
                variant={recurrence === 'monthly' ? 'default' : 'outline'}
                className="justify-start h-auto py-3"
                onClick={() => setRecurrence('monthly')}
              >
                {t('onboarding.step3.everyMonthDate', { day: dayOfMonth })}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t('onboarding.step3.recurrenceHint')}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
              {t('onboarding.back')}
            </Button>
            <Button
              className="flex-1"
              disabled={isPending || !matchDate}
              onClick={() => step3.mutate()}
            >
              {t('onboarding.next')}
            </Button>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('onboarding.step4.emails')}</Label>
            <p className="text-sm text-muted-foreground">{t('onboarding.step4.emailsHint')}</p>
            <EmailPillsInput
              emails={emails}
              onChange={setEmails}
              placeholder={t('onboarding.step4.emailsPlaceholder')}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Button
              className="w-full"
              disabled={isPending || emails.length === 0}
              onClick={() => step4.mutate()}
            >
              {t('onboarding.step4.sendInvites')}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              disabled={isPending}
              onClick={() => navigate('/dashboard')}
            >
              {t('onboarding.step4.skip')}
            </Button>
            <Button variant="outline" disabled={isPending} onClick={() => setStep(3)}>
              {t('onboarding.back')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
