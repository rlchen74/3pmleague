import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import type { Player } from '../Login'

type Result = {
  tables: { day: string; players: number[] }[]
  unplaced: { playerId: number; reason: string }[]
  searchComplete: boolean
}

export default function SuggestedTables({ weekStart, me }: { weekStart: string; me: Player }) {
  const { data: names = [] } = useQuery({
    queryKey: ['players'],
    queryFn: () => api<{ id: number; firstName: string }[]>('/api/players'),
  })
  const { data, isLoading, isError } = useQuery({
    queryKey: ['pairings', weekStart],
    queryFn: () => api<Result>(`/api/pairings?weekStart=${weekStart}`),
  })
  const nameOf = (id: number) => names.find((n) => n.id === id)?.firstName ?? `#${id}`
  const dayLabel = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString('en-US', {
      weekday: 'long', month: 'short', day: 'numeric',
    })

  return (
    <section className="mt-6">
      <h2 className="text-xl font-bold">Suggested tables</h2>
      <p className="mb-3 text-sm text-slate-600">
        Based on who's free and who you've already played. These are suggestions, so
        organize the details with your table.
      </p>

      {isLoading && <p>Working out matchups...</p>}
      {isError && <p>Couldn't load suggestions.</p>}

      {data?.tables.length === 0 && (
        <p className="rounded-lg bg-white p-3 text-sm shadow">
          No valid tables yet this week. More people marking days free will help.
        </p>
      )}
      {data?.tables.map((t, i) => {
        const mine = t.players.includes(me.id)
        return (
          <div
            key={i}
            className={`mb-2 rounded-lg p-3 shadow ${
              mine ? 'bg-emerald-700 text-white' : 'bg-white'
            }`}
          >
            <p className="font-semibold">{dayLabel(t.day)}</p>
            <p className="text-sm">
              {t.players.map(nameOf).join(' · ')}
              {mine && ' (you!)'}
            </p>
          </div>
        )
      })}

      {data && data.unplaced.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-semibold">
            Not seated this week ({data.unplaced.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {data.unplaced.map((u) => (
              <li key={u.playerId}>
                <b>{nameOf(u.playerId)}</b>: {u.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
      {data && !data.searchComplete && (
        <p className="mt-2 text-xs text-slate-500">
          Search was cut short, so a better combination might exist.
        </p>
      )}
    </section>
  )
}