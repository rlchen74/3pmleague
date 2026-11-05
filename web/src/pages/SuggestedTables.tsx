import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import type { Player } from '../Login'

type Result = {
  options: { day: string; opponents: number[] }[]
  reason: string | null
}

export default function SuggestedTables({ weekStart, me }: { weekStart: string; me: Player }) {
  const [shuffle, setShuffle] = useState(0)
  const { data: names = [] } = useQuery({
    queryKey: ['players'],
    queryFn: () => api<{ id: number; firstName: string }[]>('/api/players'),
  })
  // The player's id and shuffle number are in the key so each view gets its own suggestions
  const { data, isLoading, isError } = useQuery({
    queryKey: ['pairings', weekStart, me.id, shuffle],
    queryFn: () => api<Result>(`/api/pairings?weekStart=${weekStart}&shuffle=${shuffle}`),
  })
  const nameOf = (id: number) => names.find((n) => n.id === id)?.firstName ?? `#${id}`
  const dayLabel = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    })

  const options = data?.options ?? []

  return (
    <section className="mb-5">
      <h2 className="text-xl font-bold">Tables for you</h2>
      <p className="mb-3 text-sm text-slate-600">
        Games you could set up this week with players you haven't faced yet. Each table has
        different people, so pick one and message them.
      </p>

      {isLoading && <p>Working out matchups...</p>}
      {isError && <p>Couldn't load suggestions.</p>}

      {data?.reason && (
        <p className="rounded-lg bg-white p-3 text-sm shadow">{data.reason}</p>
      )}

      {options.map((o, i) => (
        <div key={i} className="mb-2 rounded-lg bg-white p-3 shadow">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-700">
            Option {i + 1}
          </p>
          <p className="font-semibold text-brand-800">{dayLabel(o.day)}</p>
          <p className="mt-1 text-sm">You · {o.opponents.map(nameOf).join(' · ')}</p>
        </div>
      ))}

      {options.length > 0 && options.length < 3 && (
        <p className="mb-2 text-xs text-slate-500">
          Only {options.length} table{options.length > 1 ? 's' : ''} possible this week with
          completely different people.
        </p>
      )}

      {options.length > 0 && (
        <button
          onClick={() => setShuffle((n) => n + 1)}
          className="rounded-lg border border-brand-300 px-3 py-2 text-sm font-semibold text-brand-900"
        >
          🔀 Show different tables
        </button>
      )}
    </section>
  )
}