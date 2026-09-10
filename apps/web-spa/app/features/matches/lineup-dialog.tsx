import { Button } from '@pitchkit/ui/components/primitives/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@pitchkit/ui/components/primitives/dialog'
import { cn } from '@pitchkit/ui/lib/utils'
import { XIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Attendance, Lineup, SportType } from '@/lib/pitchkit-api'
import { getCourtImage } from './court-by-sport'
import { LineupPitch } from './lineup-pitch'
import { getPlayerFirstName, getPlayerInitials } from './lineup-positions'

type TeamSide = 'blue' | 'red'
type TeamDraft = Record<string, TeamSide>

interface LineupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  presentPlayers: Attendance[]
  lineups: Lineup[]
  sportType?: SportType | null
  isPending?: boolean
  onSave: (assignments: Array<{ userId: string; team: TeamSide }>) => void
}

export function LineupDialog({
  open,
  onOpenChange,
  presentPlayers,
  lineups,
  sportType,
  isPending,
  onSave,
}: LineupDialogProps) {
  const { t } = useTranslation()
  const [side, setSide] = useState<TeamSide>('blue')
  const [draft, setDraft] = useState<TeamDraft>({})
  const [initialSerialized, setInitialSerialized] = useState('')
  const lineupsRef = useRef(lineups)
  lineupsRef.current = lineups

  useEffect(() => {
    if (!open) return
    const next = draftFromLineups(lineupsRef.current)
    setDraft(next)
    setInitialSerialized(serializeDraft(next))
    setSide('blue')
  }, [open])

  const courtSrc = getCourtImage(sportType)
  const isDirty = serializeDraft(draft) !== initialSerialized
  const presentIds = useMemo(
    () => new Set(presentPlayers.map((player) => player.userId)),
    [presentPlayers],
  )

  const sidePlayers = useMemo(
    () => presentPlayers.filter((player) => draft[player.userId] === side),
    [draft, presentPlayers, side],
  )

  const availablePlayers = useMemo(
    () => presentPlayers.filter((player) => draft[player.userId] !== side),
    [draft, presentPlayers, side],
  )

  const otherSide: TeamSide = side === 'blue' ? 'red' : 'blue'

  function handleAssign(userId: string) {
    setDraft((prev) => ({ ...prev, [userId]: side }))
  }

  function handleRemove(userId: string) {
    setDraft((prev) => {
      const next = { ...prev }
      delete next[userId]
      return next
    })
  }

  function handleSave() {
    const assignments = Object.entries(draft)
      .filter(([userId]) => presentIds.has(userId))
      .map(([userId, team]) => ({ userId, team }))
    onSave(assignments)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[90vh] w-full flex-col gap-3 overflow-hidden sm:max-w-3xl"
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogClose render={<Button variant="ghost" size="icon-sm" />}>
              <XIcon />
              <span className="sr-only">{t('matches.detail.lineupEditor.close')}</span>
            </DialogClose>
            <DialogTitle className="flex-1 text-center">
              {t('matches.detail.lineupEditor.title')}
            </DialogTitle>
            <Button size="sm" onClick={handleSave} disabled={!isDirty || isPending}>
              {t('matches.detail.lineupEditor.save')}
            </Button>
          </div>
          <DialogDescription className="sr-only">
            {t('matches.detail.lineupEditor.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center">
          <div className="inline-flex rounded-full bg-muted p-1">
            <TeamToggleButton
              active={side === 'blue'}
              tone="blue"
              label={t('matches.detail.lineupEditor.teamBlue')}
              onClick={() => setSide('blue')}
            />
            <TeamToggleButton
              active={side === 'red'}
              tone="red"
              label={t('matches.detail.lineupEditor.teamRed')}
              onClick={() => setSide('red')}
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto lg:flex-row">
          <div className="min-w-0 flex-1">
            <LineupPitch
              courtSrc={courtSrc}
              team={side}
              players={sidePlayers}
              onRemove={handleRemove}
            />
          </div>
          <aside className="w-full shrink-0 lg:w-56">
            <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {t('matches.detail.lineupEditor.available')}
            </h3>
            {availablePlayers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('matches.detail.lineupEditor.empty')}
              </p>
            ) : (
              <ul className="space-y-1">
                {availablePlayers.map((player) => {
                  const isOnOtherTeam = draft[player.userId] === otherSide
                  return (
                    <li key={player.userId}>
                      <button
                        type="button"
                        onClick={() => handleAssign(player.userId)}
                        className="flex w-full items-center gap-2 rounded-lg border px-2 py-2 text-left hover:bg-muted"
                      >
                        <span
                          className={cn(
                            'flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white',
                            isOnOtherTeam ? 'bg-muted-foreground' : 'bg-primary',
                          )}
                        >
                          {getPlayerInitials(player.userName)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {getPlayerFirstName(player.userName)}
                          </span>
                          {isOnOtherTeam ? (
                            <span className="text-xs text-muted-foreground">
                              {t('matches.detail.lineupEditor.otherTeam')}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TeamToggleButton({
  active,
  tone,
  label,
  onClick,
}: {
  active: boolean
  tone: TeamSide
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
        active && tone === 'blue' && 'bg-blue-600 text-white',
        active && tone === 'red' && 'bg-red-600 text-white',
        !active && 'text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
  )
}

function draftFromLineups(lineups: Lineup[]): TeamDraft {
  const next: TeamDraft = {}
  for (const lineup of lineups) {
    next[lineup.userId] = lineup.team
  }
  return next
}

function serializeDraft(draft: TeamDraft): string {
  return Object.entries(draft)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([userId, team]) => `${userId}:${team}`)
    .join('|')
}
