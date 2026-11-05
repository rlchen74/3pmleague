import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { Player } from '../Login'
import {
  gameSchema,
  parseOrThrow,
  handDeltas,
  HANDS_PER_GAME,
  FAAN_MIN,
  FAAN_MAX,
  DEAL_IN_PENALTY,
  SELF_DRAW_PENALTY,
  type HandInput,
} from '../../../shared/schemas'

type Slot = { playerId: string; counts: boolean }
type HandRow = { winner: string; selfDraw: boolean; discarder: string; faan: string }
type RecentGame = {
  id: number
  playedOn: string
  enteredBy: number | null
  results: { playerId: number; firstName: string; score: number; countsTowardStandings: boolean }[]
  hands: {
    handNumber: number
    winnerId: number | null
    discarderId: number | null
    selfDraw: boolean
    faan: number | null
  }[]
}

const blankSlot = (): Slot => ({ playerId: '', counts: true })
const blankHand = (): HandRow => ({ winner: '', selfDraw: false, discarder: '', faan: '' })
const field = 'w-full rounded-lg border border-brand-300 bg-white p-2 disabled:opacity-50'

const toHand = (r: HandRow): HandInput =>
  r.winner === 'draw'
    ? { isDraw: true, winnerId: null, selfDraw: false, discarderId: null, faan: null }
    : {
        isDraw: false,
        winnerId: Number(r.winner),
        selfDraw: r.selfDraw,
        discarderId: r.selfDraw || !r.discarder ? null : Number(r.discarder),
        faan: r.faan === '' ? null : Number(r.faan),
      }

// A hand counts toward the running totals only when it is fully and legally filled in
const isComplete = (r: HandRow) =>
  r.winner === 'draw' ||
  (r.winner !== '' &&
    r.faan !== '' &&
    Number(r.faan) >= FAAN_MIN &&
    Number(r.faan) <= FAAN_MAX &&
    (r.selfDraw || r.discarder !== ''))

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
  const [slots, setSlots] = useState<Slot[]>([blankSlot(), blankSlot(), blankSlot(), blankSlot()])
  const [rows, setRows] = useState<HandRow[]>(Array.from({ length: HANDS_PER_GAME }, blankHand))
  const [error, setError] = useState('')

  const nameOf = (id: string | number) => names.find((n) => n.id === Number(id))?.firstName ?? '?'
  const chosen = slots.map((s) => s.playerId).filter(Boolean)
  const allPicked = chosen.length === 4
  const ids = slots.map((s) => Number(s.playerId))
  const picked = slots.filter((s) => s.playerId)

  // Running totals from completed hands
  const totals = slots.map(() => 0)
  if (allPicked) {
    for (const r of rows) {
      if (!isComplete(r)) continue
      const d = handDeltas(toHand(r), ids)
      ids.forEach((id, k) => {
        totals[k] += d[id]
      })
    }
  }

  const setSlot = (i: number, patch: Partial<Slot>) =>
    setSlots((ss) => ss.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  const setHand = (i: number, patch: Partial<HandRow>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  function changePlayer(i: number, value: string) {
    const old = slots[i].playerId
    setSlot(i, { playerId: value })
    if (old) {
      // Clear any hand that pointed at the player who was swapped out
      setRows((rs) =>
        rs.map((r) => ({
          ...r,
          winner: r.winner === old ? '' : r.winner,
          discarder: r.discarder === old ? '' : r.discarder,
        })),
      )
    }
  }

  function changeWinner(i: number, value: string) {
    if (value === 'draw') {
      setHand(i, { winner: 'draw', selfDraw: false, discarder: '', faan: '' })
    } else {
      setHand(i, { winner: value, discarder: rows[i].discarder === value ? '' : rows[i].discarder })
    }
  }

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['games'] })
    qc.invalidateQueries({ queryKey: ['standings'] })
    qc.invalidateQueries({ queryKey: ['pairings'] })
  }

  const save = useMutation({
    mutationFn: () => {
      const payload = parseOrThrow(gameSchema, {
        playedOn,
        players: slots.map((s) => ({
          playerId: Number(s.playerId),
          countsTowardStandings: s.counts,
        })),
        hands: rows.map(toHand),
      })
      return api('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    },
    onSuccess: () => {
      setSlots([blankSlot(), blankSlot(), blankSlot(), blankSlot()])
      setRows(Array.from({ length: HANDS_PER_GAME }, blankHand))
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

  const ready = allPicked && rows.every((r) => r.winner !== '')

  const describe = (g: RecentGame, h: RecentGame['hands'][number]) => {
    const n = (id: number | null) => g.results.find((r) => r.playerId === id)?.firstName ?? '?'
    if (h.winnerId === null) return 'Draw'
    return `${n(h.winnerId)} won ${h.faan} faan, ${h.selfDraw ? 'self-draw' : `dealt in by ${n(h.discarderId)}`}`
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Enter a game</h1>
      <p className="mb-3 text-sm text-slate-600">
        Every winning hand must be worth at least {FAAN_MIN} faan. Winner scores 2 × faan − 3. A
        deal-in loses {DEAL_IN_PENALTY}. On a self-draw, each other player loses {SELF_DRAW_PENALTY}.
        A draw changes nothing.
      </p>

      <label className="block text-sm font-semibold">
        Date played
        <input type="date" value={playedOn} onChange={(e) => setPlayedOn(e.target.value)} className={`${field} mt-1`} />
      </label>

      <h2 className="mb-1 mt-5 text-lg font-bold">Players</h2>
      {slots.map((s, i) => (
        <div key={i} className="mt-2 rounded-lg bg-white p-3 shadow">
          <select value={s.playerId} onChange={(e) => changePlayer(i, e.target.value)} className={field}>
            <option value="">Player {i + 1}...</option>
            {names.map((n) => (
              <option
                key={n.id}
                value={n.id}
                disabled={chosen.includes(String(n.id)) && s.playerId !== String(n.id)}
              >
                {n.firstName}
              </option>
            ))}
          </select>
          <label className="mt-2 flex items-center gap-2 text-xs">
            <input type="checkbox" checked={!s.counts} onChange={(e) => setSlot(i, { counts: !e.target.checked })} />
            Friendly game for this player (doesn't count toward standings)
          </label>
        </div>
      ))}

      <h2 className="mb-1 mt-5 text-lg font-bold">Hands</h2>
      {rows.map((r, i) => {
        const draw = r.winner === 'draw'
        return (
          <div key={i} className="mt-2 rounded-lg bg-white p-3 shadow">
            <p className="mb-2 text-sm font-bold text-brand-800">Hand {i + 1}</p>
            <label className="block text-xs font-semibold">
              Winner
              <select
                value={r.winner}
                onChange={(e) => changeWinner(i, e.target.value)}
                disabled={!allPicked}
                className={field}
              >
                <option value="">{allPicked ? 'Choose...' : 'Pick the four players first'}</option>
                {picked.map((s) => (
                  <option key={s.playerId} value={s.playerId}>
                    {nameOf(s.playerId)}
                  </option>
                ))}
                <option value="draw">Draw (no winner)</option>
              </select>
            </label>

            <div className={`mt-2 grid grid-cols-2 gap-2 ${draw ? 'opacity-40' : ''}`}>
              <label className="flex items-center gap-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={r.selfDraw}
                  disabled={draw || r.winner === ''}
                  onChange={(e) => setHand(i, { selfDraw: e.target.checked, discarder: '' })}
                />
                Self-draw
              </label>
              <label className="text-xs font-semibold">
                Faan
                <input
                  type="number"
                  min={FAAN_MIN}
                  max={FAAN_MAX}
                  value={r.faan}
                  disabled={draw || r.winner === ''}
                  onChange={(e) => setHand(i, { faan: e.target.value })}
                  className={field}
                />
              </label>
              {!r.selfDraw && (
                <label className="col-span-2 text-xs font-semibold">
                  Dealt in by
                  <select
                    value={r.discarder}
                    disabled={draw || r.winner === ''}
                    onChange={(e) => setHand(i, { discarder: e.target.value })}
                    className={field}
                  >
                    <option value="">Choose...</option>
                    {picked
                      .filter((s) => s.playerId !== r.winner)
                      .map((s) => (
                        <option key={s.playerId} value={s.playerId}>
                          {nameOf(s.playerId)}
                        </option>
                      ))}
                  </select>
                </label>
              )}
            </div>
          </div>
        )
      })}

      {allPicked && (
        <div className="mt-4 rounded-lg bg-brand-100 p-3 text-sm">
          <p className="font-semibold">Running totals (completed hands)</p>
          <p>
            {slots
              .map((s, k) => `${nameOf(s.playerId)} ${totals[k] > 0 ? '+' : ''}${totals[k]}`)
              .join(' · ')}
          </p>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      <button
        onClick={() => save.mutate()}
        disabled={!ready || save.isPending}
        className="mt-4 w-full rounded-lg bg-brand-800 p-3 font-semibold text-white disabled:opacity-40"
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
              <button
                onClick={() => confirm('Delete this game?') && remove.mutate(g.id)}
                className="text-red-700 underline"
              >
                Delete
              </button>
            )}
          </div>
          <p className="mt-1">
            {g.results
              .map((r) => `${r.firstName} ${r.score}${r.countsTowardStandings ? '' : '*'}`)
              .join(' · ')}
          </p>
          {g.hands.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer text-brand-800">Hand details</summary>
              <ol className="mt-1 list-decimal space-y-0.5 pl-5">
                {g.hands.map((h) => (
                  <li key={h.handNumber}>{describe(g, h)}</li>
                ))}
              </ol>
            </details>
          )}
        </div>
      ))}
    </div>
  )
}