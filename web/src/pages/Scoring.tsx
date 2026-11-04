import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { Player } from '../Login'

type Row = { playerId: string; score: string; wins: string; bestHand: string; counts: boolean }
type RecentGame = {
  id: number
  playedOn: string
  enteredBy: number | null
  results: { playerId: number; firstName: string; score: number; countsTowardStandings: boolean }[]
}

const blank = (): Row => ({ playerId: '', score: '', wins: '0', bestHand: '0', counts: true })
const field = 'w-full rounded-lg border border-emerald-300 bg-white p-2'

export default function Scoring({ me }: { me: Player }) {
  const qc = useQueryClient()
  const { data: names = [] } = useQuery({
    queryKey: ['players'],
    queryFn: () => api<{ id: number; firstName: string }[]>('/api/players'),
  })
  const { data: recent = [] } = useQuery({
    queryKey: ['games'],
    queryFn: () => api<RecentGame[]>('/api/games'),
  })
  const [playedOn, setPlayedOn] = useState(new Date().toLocaleDateString('en-CA'))
  const [rows, setRows] = useState<Row[]>([blank(), blank(), blank(), blank()])
  const [error, setError] = useState('')

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['games'] })
    qc.invalidateQueries({ queryKey: ['standings'] })
  }
  const set = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  const save = useMutation({
    mutationFn: () =>
      api('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playedOn,
          results: rows.map((r) => ({
            playerId: Number(r.playerId),
            score: Number(r.score),
            wins: Number(r.wins),
            bestHand: Number(r.bestHand),
            countsTowardStandings: r.counts,
          })),
        }),
      }),
    onSuccess: () => {
      setRows([blank(), blank(), blank(), blank()])
      setError('')
      refresh()
    },
    onError: (e: Error) => setError(e.message),
  })

  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/games/${id}`, { method: 'DELETE' }),
    onSuccess: refresh,
    onError: (e: Error) => setError(e.message),
  })

  const ready = rows.every((r) => r.playerId && r.score !== '')

  return (
    <div>
      <h1 className="mb-3 text-2xl font-bold">Enter a game</h1>
      <label className="block text-sm font-semibold">
        Date played
        <input type="date" value={playedOn} onChange={(e) => setPlayedOn(e.target.value)} className={`${field} mt-1`} />
      </label>

      {rows.map((r, i) => (
        <div key={i} className="mt-3 rounded-lg bg-white p-3 shadow">
          <select value={r.playerId} onChange={(e) => set(i, { playerId: e.target.value })} className={field}>
            <option value="">Player {i + 1}...</option>
            {names.map((n) => (
              <option key={n.id} value={n.id}>{n.firstName}</option>
            ))}
          </select>
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs font-semibold">
            <label>Score
              <input type="number" value={r.score} onChange={(e) => set(i, { score: e.target.value })} className={field} />
            </label>
            <label>Wins
              <input type="number" min={0} value={r.wins} onChange={(e) => set(i, { wins: e.target.value })} className={field} />
            </label>
            <label>Best hand
              <input type="number" min={0} value={r.bestHand} onChange={(e) => set(i, { bestHand: e.target.value })} className={field} />
            </label>
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs">
            <input type="checkbox" checked={!r.counts} onChange={(e) => set(i, { counts: !e.target.checked })} />
            Friendly game for this player (doesn't count toward standings)
          </label>
        </div>
      ))}

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      <button
        onClick={() => save.mutate()}
        disabled={!ready || save.isPending}
        className="mt-4 w-full rounded-lg bg-emerald-800 p-3 font-semibold text-white disabled:opacity-40"
      >
        {save.isPending ? 'Saving...' : 'Submit game'}
      </button>

      <h2 className="mb-2 mt-8 text-xl font-bold">Recent games</h2>
      {recent.length === 0 && <p className="text-sm text-slate-600">No games yet.</p>}
      {recent.map((g) => (
        <div key={g.id} className="mb-2 rounded-lg bg-white p-3 text-sm shadow">
          <div className="flex justify-between font-semibold">
            <span>{g.playedOn}</span>
            {(g.enteredBy === me.id || me.isAdmin) && (
              <button onClick={() => confirm('Delete this game?') && remove.mutate(g.id)} className="text-red-700 underline">
                Delete
              </button>
            )}
          </div>
          <p className="mt-1">
            {g.results.map((r) => `${r.firstName} ${r.score}${r.countsTowardStandings ? '' : '*'}`).join(' · ')}
          </p>
        </div>
      ))}
    </div>
  )
}