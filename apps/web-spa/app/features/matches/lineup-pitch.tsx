import { cn } from '@pitchkit/ui/lib/utils'
import { getLineupPositions, getPlayerFirstName, getPlayerInitials } from './lineup-positions'

interface PitchPlayer {
  userId: string
  userName: string
}

interface LineupPitchProps {
  courtSrc: string
  team: 'blue' | 'red'
  players: PitchPlayer[]
  onRemove: (userId: string) => void
}

export function LineupPitch({ courtSrc, team, players, onRemove }: LineupPitchProps) {
  const positions = getLineupPositions(players.length)

  return (
    <div className="relative mx-auto w-full max-w-[280px] overflow-hidden rounded-lg bg-black sm:max-w-[320px]">
      <img src={courtSrc} alt="" className="block h-auto w-full select-none" draggable={false} />
      {players.map((player, index) => {
        const position = positions[index]
        if (!position) return null
        return (
          <button
            key={player.userId}
            type="button"
            onClick={() => onRemove(player.userId)}
            aria-label={player.userName}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${position.x}%`, top: `${position.y}%` }}
          >
            <PlayerBubble name={player.userName} team={team} />
          </button>
        )
      })}
    </div>
  )
}

function PlayerBubble({ name, team }: { name: string; team: 'blue' | 'red' }) {
  const firstName = getPlayerFirstName(name)
  const initials = getPlayerInitials(name)

  return (
    <span className="flex flex-col items-center gap-1">
      <span
        className={cn(
          'flex size-12 items-center justify-center rounded-full border-2 text-xs font-semibold text-white shadow-md',
          team === 'blue' ? 'border-blue-300 bg-blue-700' : 'border-red-300 bg-red-700',
        )}
      >
        {initials}
      </span>
      <span className="max-w-16 truncate text-[10px] font-semibold tracking-wide text-white uppercase drop-shadow">
        {firstName}
      </span>
    </span>
  )
}
