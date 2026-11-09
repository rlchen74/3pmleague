import { useEffect, useRef, useState } from 'react'
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
  type DraftData,
} from '../../../shared/schemas'

type Slot = { playerId: string; counts: boolean }
type HandRow = { winner: string; selfDraw: boolean; discarder: string; faan: string }
type DraftRow = { id: number; updatedAt: string; data: DraftData }
type RecentGame = {
  id: number
  playedOn: string
  enteredBy: number | null
  results: {
    playerId: number
    firstName: string
    score: number
    countsTowardStandings: boolean
  }[]
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
const today = () => new Date().toLocaleDateString('en-CA')
const JSON_HEADERS = { 'Content-Type': 'application/json' }

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
    queryFn: () => api<{ id: number; firstName: string; isActive: boolean }[]>('/api/players'),
  })
  const { data: recent = [] } = useQuery({
    queryKey: ['games'],
    queryFn: () => api<RecentGame[]>('/api/games'),
  })
  const { data: drafts = [] } = useQuery({
    queryKey: ['drafts'],
    queryFn: () => api<DraftRow[]>('/api/drafts'),
  })

  const [editingId, setEditingId] = useState<number | null>(null)
  const [draftId, setDraftId] = useState<number | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveNote, setSaveNote] = useState('')
  const [playedOn, setPlayedOn] = useState(today())
  const [slots, setSlots] = useState<Slot[]>([blankSlot(), blankSlot(), blankSlot(), blankSlot()])
  const [rows, setRows] = useState<HandRow[]>(Array.from({ length: HANDS_PER_GAME }, blankHand))
  const [error, setError] = useState('')

  // Refs let the auto-save see the latest form without re-running on every keystroke
  const draftIdRef = useRef<number | null>(null)
  const inFlight = useRef(false)
  const dirty = useRef(false)
  const latest = useRef<{ playedOn: string; slots: Slot[]; rows: HandRow[] }>({
    playedOn: '',
    slots: [],
    rows: [],
  })

  const nameOf = (id: string | number) => names.find((n) => n.id === Number(id))?.firstName ?? '?'
  const chosen = slots.map((s) => s.playerId).filter(Boolean)
  const allPicked = chosen.length === 4
  const ids = slots.map((s) => Number(s.playerId))
  const picked = slots.filter((s) => s.playerId)
  // Inactive players only appear if they are already part of the game being edited
  const selectable = names.filter((n) => n.isActive || chosen.includes(String(n.id)))

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

  // Save the form as a draft. Saves never overlap: if one is running, the next waits for it.
  async function persist(): Promise<void> {
    if (inFlight.current) {
      dirty.current = true
      return
    }
    inFlight.current = true
    setSaveState('saving')
    try {
      const cur = latest.current
      const body = JSON.stringify({ playedOn: cur.playedOn, players: cur.slots, hands: cur.rows })
      if (draftIdRef.current) {
        await api(`/api/drafts/${draftIdRef.current}`, {
          method: 'PUT',
          headers: JSON_HEADERS,
          body,
        })
      } else {
        const created = await api<{ id: number }>('/api/drafts', {
          method: 'POST',
          headers: JSON_HEADERS,
          body,
        })
        draftIdRef.current = created.id
        setDraftId(created.id)
        qc.invalidateQueries({ queryKey: ['drafts'] })
      }
      setSaveState('saved')
      setSaveNote('')
    } catch (e) {
      if (draftIdRef.current && (e as Error).message === 'Draft not found') {
        // The draft was deleted somewhere else, so start a fresh one on the next save
        draftIdRef.current = null
        setDraftId(null)
        dirty.current = true
      } else {
        setSaveState('error')
        setSaveNote((e as Error).message)
      }
    } finally {
      inFlight.current = false
      if (dirty.current) {
        dirty.current = false
        void persist()
      }
    }
  }

  // Auto-save about a second after the form stops changing
  useEffect(() => {
    latest.current = { playedOn, slots, rows }
    if (editingId !== null) return undefined
    const blank = slots.every((s) => !s.playerId) && rows.every((r) => r.winner === '')
    if (blank && draftIdRef.current === null) return undefined
    const t = setTimeout(() => void persist(), 1200)
    return () => clearTimeout(t)
  }, [playedOn, slots, rows, editingId])

  const setSlot = (i: number, patch: Partial<Slot>) =>
    setSlots((ss) => ss.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  const setHand = (i: number, patch: Partial<HandRow>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  function resetForm() {
    setEditingId(null)
    draftIdRef.current = null
    setDraftId(null)
    setSaveState('idle')
    setSaveNote('')
    setPlayedOn(today())
    setSlots([blankSlot(), blankSlot(), blankSlot(), blankSlot()])
    setRows(Array.from({ length: HANDS_PER_GAME }, blankHand))
    setError('')
  }

  function startEdit(g: RecentGame) {
    draftIdRef.current = null
    setDraftId(null)
    setSaveState('idle')
    setEditingId(g.id)
    setPlayedOn(g.playedOn)
    setSlots(
      g.results.map((r) => ({ playerId: String(r.playerId), counts: r.countsTowardStandings })),
    )
    setRows(
      Array.from({ length: HANDS_PER_GAME }, (_, i) => {
        const h = g.hands.find((x) => x.handNumber === i + 1)
        if (!h) return blankHand()
        if (h.winnerId === null) return { winner: 'draw', selfDraw: false, discarder: '', faan: '' }
        return {
          winner: String(h.winnerId),
          selfDraw: h.selfDraw,
          discarder: h.discarderId ? String(h.discarderId) : '',
          faan: h.faan === null ? '' : String(h.faan),
        }
      }),
    )
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resumeDraft(d: DraftRow) {
    setEditingId(null)
    draftIdRef.current = d.id
    setDraftId(d.id)
    setSaveState('saved')
    setSaveNote('')
    setPlayedOn(d.data.playedOn || today())
    setSlots(Array.from({ length: 4 }, (_, i) => d.data.players[i] ?? blankSlot()))
    setRows(Array.from({ length: HANDS_PER_GAME }, (_, i) => d.data.hands[i] ?? blankHand()))
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

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
      return api(editingId ? `/api/games/${editingId}` : '/api/games', {
        method: editingId ? 'PUT' : 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify(payload),
      })
    },
    onSuccess: () => {
      // The finished game replaces its draft
      const finishedDraft = draftIdRef.current
      resetForm()
      refresh()
      if (finishedDraft) {
        api(`/api/drafts/${finishedDraft}`, { method: 'DELETE' }).finally(() =>
          qc.invalidateQueries({ queryKey: ['drafts'] }),
        )
      }
    },
    onError: (e: Error) => setError(e.message),
  })

  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/games/${id}`, { method: 'DELETE' }),
    onSuccess: (_d, id) => {
      if (id === editingId) resetForm()
      refresh()
    },
    onError: (e: Error) => setError(e.message),
  })

  const discard = useMutation({
    mutationFn: (id: number) => api(`/api/drafts/${id}`, { method: 'DELETE' }),
    onSuccess: (_d, id) => {
      if (id === draftIdRef.current) resetForm()
      qc.invalidateQueries({ queryKey: ['drafts'] })
    },
    onError: (e: Error) => setError(e.message),
  })

  const ready = allPicked && rows.every((r) => r.winner !== '')
  const openDrafts = drafts.filter((d) => d.id !== draftId)

  const describe = (g: RecentGame, h: RecentGame['hands'][number]) => {
    const n = (id: number | null) => g.results.find((r) => r.playerId === id)?.firstName ?? '?'
    if (h.winnerId === null) return 'Draw'
    return `${n(h.winnerId)} won ${h.faan} faan, ${h.selfDraw ? 'self-draw' : `dealt in by ${n(h.discarderId)}`}`
  }

  const summarize = (d: DraftData) => {
    const who =
      d.players
        .filter((p) => p.playerId)
        .map((p) => nameOf(p.playerId))
        .join(', ') || 'No players yet'
    const done = d.hands.filter((h) => h.winner !== '').length
    return `${who} · ${done}/${HANDS_PER_GAME} hands`
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">{editingId ? 'Edit game' : 'Enter a game'}</h1>
      {editingId && (
        <div className="mb-3 flex items-center justify-between rounded-lg bg-amber-100 p-2 text-sm text-amber-950">
          <span>Editing a saved game. Saving replaces its hands and scores.</span>
          <button onClick={resetForm} className="font-semibold underline">
            Cancel
          </button>
        </div>
      )}
      <p className="mb-3 text-sm text-slate-600">
        Every winning hand must be worth at least {FAAN_MIN} faan. Winner scores 2 × faan − 3. A
        deal-in loses {DEAL_IN_PENALTY}. On a self-draw, each other player loses {SELF_DRAW_PENALTY}.
        A draw changes nothing. Your progress saves automatically as you go.
      </p>

      {!editingId && openDrafts.length > 0 && (
        <div className="mb-4 rounded-lg bg-brand-100 p-3">
          <p className="mb-1 text-sm font-bold">Games in progress</p>
          {openDrafts.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between gap-2 border-t border-brand-200 py-2 first:border-t-0"
            >
              <span className="text-sm">{summarize(d.data)}</span>
              <span className="flex shrink-0 gap-3 text-sm">
                <button onClick={() => resumeDraft(d)} className="font-semibold text-brand-800 underline">
                  Resume
                </button>
                <button
                  onClick={() => confirm('Discard this game in progress?') && discard.mutate(d.id)}
                  className="text-red-700 underline"
                >
                  Discard
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {!editingId && (draftId !== null || saveState !== 'idle') && (
        <div className="mb-3 flex items-center justify-between gap-2 text-xs">
          <span className={saveState === 'error' ? 'text-red-700' : 'text-slate-600'}>
            {saveState === 'saving'
              ? 'Saving progress...'
              : saveState === 'error'
                ? `Couldn't save progress: ${saveNote}`
                : 'Progress saved. You can leave and come back to this game.'}
          </span>
          {draftId !== null && (
            <button onClick={resetForm} className="shrink-0 font-semibold text-brand-800 underline">
              Start a different game
            </button>
          )}
        </div>
      )}

      <label className="block text-sm font-semibold">
        Date played
        <input type="date" value={playedOn} onChange={(e) => setPlayedOn(e.target.value)} className={`${field} mt-1`} />
      </label>

      <h2 className="mb-1 mt-5 text-lg font-bold">Players</h2>
      {slots.map((s, i) => (
        <div key={i} className="mt-2 rounded-lg bg-white p-3 shadow">
          <select value={s.playerId} onChange={(e) => changePlayer(i, e.target.value)} className={field}>
            <option value="">Player {i + 1}...</option>
            {selectable.map((n) => (
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

      {allPicked && (
        <div className="mt-4 rounded-lg bg-brand-100 sticky top-0 z-10 p-3">
          <p className="mb-2 text-sm font-semibold">Running totals (completed hands)</p>
          <div className="grid grid-cols-4 gap-2 text-center">
            {slots.map((s, k) => (
              <div key={s.playerId} className="rounded-lg bg-white p-2 shadow">
                <p className="truncate text-xs font-semibold">{nameOf(s.playerId)}</p>
                <p
                  className={`text-xl font-extrabold ${totals[k] < 0 ? 'text-red-700' : 'text-brand-800'}`}
                >
                  {totals[k] > 0 ? '+' : ''}
                  {totals[k]}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      <button
        onClick={() => save.mutate()}
        disabled={!ready || save.isPending}
        className="mt-4 w-full rounded-lg bg-brand-800 p-3 font-semibold text-white disabled:opacity-40"
      >
        {save.isPending ? 'Saving...' : editingId ? 'Save changes' : 'Submit game'}
      </button>

      <h2 className="mb-2 mt-8 text-xl font-bold">Recent games</h2>
      {recent.length === 0 && <p className="text-sm text-slate-600">No games yet.</p>}
      {recent.map((g) => (
        <div key={g.id} className="mb-2 rounded-lg bg-white p-3 text-sm shadow">
          <div className="flex justify-between font-semibold">
            <span>{g.playedOn}</span>
            {(g.enteredBy === me.id || me.isAdmin) && (
              <span className="flex gap-3">
                <button onClick={() => startEdit(g)} className="text-brand-800 underline">
                  Edit
                </button>
                <button
                  onClick={() => confirm('Delete this game?') && remove.mutate(g.id)}
                  className="text-red-700 underline"
                >
                  Delete
                </button>
              </span>
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