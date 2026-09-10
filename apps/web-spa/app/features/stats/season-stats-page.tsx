import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { useClub } from '@/features/clubs/club-context'
import { pitchkitApi } from '@/lib/pitchkit-api'

export default function SeasonStatsPage() {
  const { seasonId } = useParams()
  const { activeClub } = useClub()

  const { data: stats = [], isLoading } = useQuery({
    queryKey: ['season-stats', activeClub?.id, seasonId],
    queryFn: () => pitchkitApi.seasonStats(activeClub!.id, seasonId!),
    enabled: !!activeClub && !!seasonId,
  })

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Season stats</h1>
      {isLoading ? <p>Loading…</p> : null}
      <table className="w-full text-sm border">
        <thead>
          <tr className="border-b bg-muted/40 text-left">
            <th className="p-2">Player</th>
            <th className="p-2">Goals</th>
            <th className="p-2">Assists</th>
            <th className="p-2">Matches</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => (
            <tr key={s.userId} className="border-b">
              <td className="p-2">{s.userName}</td>
              <td className="p-2">{s.goals}</td>
              <td className="p-2">{s.assists}</td>
              <td className="p-2">{s.matchesPlayed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
