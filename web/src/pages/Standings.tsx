import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { Tile } from '../tiles'

interface Row {
  id: number
  firstName: string
  tile: string | null
  games: number
  points: number
  wins: number
  dealIns: number
}
type Season = { id: number; name: string; isCurrent: boolean }

export default function Standings() {
  const [picked, setPicked] = useState<number | null>(null)
  const { data: seasons = [] } = useQuery({
    queryKey: ['seasons'],
    queryFn: () => api<Season[]>('/api/seasons'),
  })
  const seasonId = picked ?? seasons.find((s) => s.isCurrent)?.id ?? null

  const { data, isLoading, isError } = useQuery({
    queryKey: ['standings', seasonId],
    queryFn: () => api<Row[]>(`/api/standings${seasonId ? `?seasonId=${seasonId}` : ''}`),
  })

  if (isLoading) return <p>Loading standings...</p>
  if (isError || !data) return <p>Couldn't load standings. Try refreshing.</p>

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Standings</h1>
        {seasons.length > 1 && (
          <select
            value={seasonId ?? ''}
            onChange={(e) => setPicked(Number(e.target.value))}
            className="rounded-lg border border-brand-300 bg-white p-2 text-sm"
          >
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.isCurrent ? ' (current)' : ''}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full text-left text-sm">
          <thead className="bg-brand-100 text-brand-900">
            <tr>
              <th className="p-3">#</th>
              <th className="p-3">Player</th>
              <th className="p-3 text-right">Pts</th>
              <th className="p-3 text-right">GP</th>
              <th className="p-3 text-right">Avg</th>
              <th className="p-3 text-right">Wins</th>
              <th className="p-3 text-right">Deal-ins</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => (
              <tr key={r.id} className="border-t border-brand-100">
                <td className="p-3">{i + 1}</td>
                <td className="p-3 font-semibold">
                  <span className="flex items-center gap-2">
                    {r.tile && (
                      <Tile t={r.tile} className="text-4xl leading-none text-brand-900" />
                    )}
                    {r.firstName}
                  </span>
                </td>
                <td className="p-3 text-right font-bold">{r.points}</td>
                <td className="p-3 text-right">{r.games}</td>
                <td className="p-3 text-right">
                  {r.games ? (r.points / r.games).toFixed(1) : '–'}
                </td>
                <td className="p-3 text-right">{r.wins}</td>
                <td className="p-3 text-right">{r.dealIns}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}