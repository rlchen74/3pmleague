import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { newPlayerSchema, newSeasonSchema, parseOrThrow } from '../../../shared/schemas'

type AdminPlayer = { id: number; firstName: string; isActive: boolean; isAdmin: boolean }
type Season = { id: number; name: string; isCurrent: boolean }

const JSON_HEADERS = { 'Content-Type': 'application/json' }
const input = 'w-full rounded-lg border border-brand-300 bg-white p-2 text-sm'

export default function Admin() {
  const qc = useQueryClient()
  const { data: people = [] } = useQuery({
    queryKey: ['admin-players'],
    queryFn: () => api<AdminPlayer[]>('/api/admin/players'),
  })
  const { data: seasons = [] } = useQuery({
    queryKey: ['seasons'],
    queryFn: () => api<Season[]>('/api/seasons'),
  })
  const [newName, setNewName] = useState('')
  const [seasonName, setSeasonName] = useState('')
  const [error, setError] = useState('')

  const refresh = (...keys: string[]) =>
    keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }))

  const addPlayer = useMutation({
    mutationFn: () =>
      api('/api/admin/players', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify(parseOrThrow(newPlayerSchema, { firstName: newName })),
      }),
    onSuccess: () => {
      setNewName('')
      setError('')
      refresh('admin-players', 'players', 'standings')
    },
    onError: (e: Error) => setError(e.message),
  })

  const toggle = useMutation({
    mutationFn: (v: { id: number; isActive: boolean }) =>
      api(`/api/admin/players/${v.id}`, {
        method: 'PUT',
        headers: JSON_HEADERS,
        body: JSON.stringify({ isActive: v.isActive }),
      }),
    onSuccess: () => {
      setError('')
      refresh('admin-players', 'players', 'standings', 'pairings')
    },
    onError: (e: Error) => setError(e.message),
  })

  const newSeason = useMutation({
    mutationFn: () =>
      api('/api/seasons/new', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify(parseOrThrow(newSeasonSchema, { name: seasonName })),
      }),
    onSuccess: () => {
      setSeasonName('')
      setError('')
      refresh('seasons', 'standings', 'games', 'pairings')
    },
    onError: (e: Error) => setError(e.message),
  })

  const current = seasons.find((s) => s.isCurrent)

  return (
    <section className="mb-8 rounded-lg border-2 border-dashed border-brand-300 p-3">
      <h2 className="mb-1 text-2xl font-bold">Admin</h2>
      {error && <p className="mb-2 text-sm text-red-700">{error}</p>}

      <h3 className="mt-3 font-bold">Players</h3>
      <p className="mb-2 text-xs text-slate-600">
        Inactive players can't log in or be scheduled, but their games stay in the standings.
      </p>
      <ul className="space-y-1">
        {people.map((p) => (
          <li key={p.id} className="flex items-center justify-between rounded bg-white p-2 text-sm shadow">
            <span className={p.isActive ? '' : 'text-slate-400 line-through'}>
              {p.firstName}
              {p.isAdmin && ' (admin)'}
            </span>
            <button
              onClick={() => toggle.mutate({ id: p.id, isActive: !p.isActive })}
              className="text-brand-800 underline"
            >
              {p.isActive ? 'Deactivate' : 'Reactivate'}
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New player's first name"
          maxLength={30}
          className={input}
        />
        <button
          onClick={() => addPlayer.mutate()}
          disabled={!newName.trim() || addPlayer.isPending}
          className="rounded-lg bg-brand-800 px-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          Add
        </button>
      </div>

      <h3 className="mt-5 font-bold">Seasons</h3>
      <p className="mb-2 text-sm">
        Current: <b>{current?.name ?? '...'}</b>
      </p>
      <div className="flex gap-2">
        <input
          value={seasonName}
          onChange={(e) => setSeasonName(e.target.value)}
          placeholder="Name of the new season"
          maxLength={40}
          className={input}
        />
        <button
          onClick={() =>
            confirm(
              `End "${current?.name}" and start "${seasonName}"? Opponent history and game counts reset.`,
            ) && newSeason.mutate()
          }
          disabled={!seasonName.trim() || newSeason.isPending}
          className="whitespace-nowrap rounded-lg bg-brand-800 px-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          Start new season
        </button>
      </div>
    </section>
  )
}