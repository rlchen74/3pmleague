import { useQuery } from '@tanstack/react-query'
import { api } from '../api'

interface Row {
  id: number
  firstName: string
  games: number
  points: number
  wins: number
  bestHand: number
}

export default function Standings() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['standings'],
    queryFn: () => api<Row[]>('/api/standings'),
  })

  if (isLoading) return <p>Loading standings...</p>
  if (isError || !data) return <p>Couldn't load standings. Try refreshing.</p>

  return (
    <div>
      <h1 className="mb-3 text-2xl font-bold">Standings</h1>
      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full text-left text-sm">
          <thead className="bg-emerald-100 text-emerald-900">
            <tr>
              <th className="p-3">#</th>
              <th className="p-3">Player</th>
              <th className="p-3 text-right">Pts</th>
              <th className="p-3 text-right">GP</th>
              <th className="p-3 text-right">Avg</th>
              <th className="p-3 text-right">Wins</th>
              <th className="p-3 text-right">Best</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => (
              <tr key={r.id} className="border-t border-emerald-100">
                <td className="p-3">{i + 1}</td>
                <td className="p-3 font-semibold">{r.firstName}</td>
                <td className="p-3 text-right font-bold">{r.points}</td>
                <td className="p-3 text-right">{r.games}</td>
                <td className="p-3 text-right">
                  {r.games ? (r.points / r.games).toFixed(1) : '–'}
                </td>
                <td className="p-3 text-right">{r.wins}</td>
                <td className="p-3 text-right">{r.bestHand}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}