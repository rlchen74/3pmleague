import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { Player } from '../Login'
import { eventSchema, parseOrThrow } from '../../../shared/schemas'
import SuggestedTables from './SuggestedTables'

type Off = { playerId: number; firstName: string; day: string }
type CalEvent = { id: number; day: string; title: string; createdBy: number; firstName: string }

// Dates are handled as plain "YYYY-MM-DD" strings to avoid timezone bugs
const iso = (d: Date) => d.toLocaleDateString('en-CA')
const addDays = (d: Date, n: number) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
const mondayOf = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}
const WINDOW_DAYS = 62
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const JSON_HEADERS = { 'Content-Type': 'application/json' }

export default function Calendar({ me }: { me: Player }) {
  const qc = useQueryClient()
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const lastDay = addDays(today, WINDOW_DAYS)
  const todayKey = iso(today)
  const lastKey = iso(lastDay)
  const inWindow = (key: string) => key >= todayKey && key <= lastKey

  const [monthOffset, setMonthOffset] = useState(0)
  const [mode, setMode] = useState<'mark' | 'view'>('mark')
  const [selected, setSelected] = useState(todayKey)
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')

  const monthStart = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1)
  const maxOffset =
    (lastDay.getFullYear() - today.getFullYear()) * 12 + lastDay.getMonth() - today.getMonth()
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate()
  const lead = (monthStart.getDay() + 6) % 7
  const cells: (Date | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from(
      { length: daysInMonth },
      (_, i) => new Date(monthStart.getFullYear(), monthStart.getMonth(), i + 1),
    ),
  ]

  const { data: off = [], isLoading } = useQuery({
    queryKey: ['unavailability'],
    queryFn: () => api<Off[]>('/api/unavailability'),
  })
  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: () => api<CalEvent[]>('/api/events'),
  })
  const { data: allPlayers = [] } = useQuery({
    queryKey: ['players'],
    queryFn: () => api<{ id: number; firstName: string; isActive: boolean }[]>('/api/players'),
    select: (rows) => rows.filter((r) => r.isActive),
  })

  const toggle = useMutation({
    mutationFn: (v: { day: string; unavailable: boolean }) =>
      api('/api/unavailability', {
        method: 'PUT',
        headers: JSON_HEADERS,
        body: JSON.stringify(v),
      }),
    // Update the screen instantly, then confirm with the server
    onMutate: async ({ day, unavailable }) => {
      await qc.cancelQueries({ queryKey: ['unavailability'] })
      const previous = qc.getQueryData<Off[]>(['unavailability'])
      qc.setQueryData<Off[]>(['unavailability'], (old = []) =>
        unavailable
          ? [...old, { playerId: me.id, firstName: me.firstName, day }]
          : old.filter((s) => !(s.playerId === me.id && s.day === day)),
      )
      return { previous }
    },
    onError: (_e, _v, ctx) => qc.setQueryData(['unavailability'], ctx?.previous),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['unavailability'] })
      qc.invalidateQueries({ queryKey: ['pairings'] })
    },
  })

  const addEvent = useMutation({
    mutationFn: (v: { day: string; title: string }) =>
      api('/api/events', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify(parseOrThrow(eventSchema, v)),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] })
      setAdding(false)
      setTitle('')
      setError('')
    },
    onError: (e: Error) => setError(e.message),
  })

  const removeEvent = useMutation({
    mutationFn: (id: number) => api(`/api/events/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
    onError: (e: Error) => setError(e.message),
  })

  const activeIds = new Set(allPlayers.map((p) => p.id))
  const offOn = (key: string) =>
    off.filter((s) => s.day === key && activeIds.has(s.playerId))
  const isOff = (key: string) => off.some((s) => s.playerId === me.id && s.day === key)

  function tap(key: string) {
    setSelected(key)
    setAdding(false)
    setError('')
    if (mode === 'mark') toggle.mutate({ day: key, unavailable: !isOff(key) })
  }

  // Details for the selected day
  const selDate = new Date(`${selected}T12:00:00`)
  const selOffIds = new Set(offOn(selected).map((s) => s.playerId))
  const freeNames = allPlayers.filter((p) => !selOffIds.has(p.id)).map((p) => p.firstName)
  const offNames = offOn(selected).map((s) => s.firstName)
  const selEvents = events.filter((e) => e.day === selected)
  const selMine = selOffIds.has(me.id)
  const selIn = inWindow(selected)

  const weekStart = mondayOf(selDate)
  const weekLabel = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Calendar</h1>
      <p className="mb-3 text-sm text-slate-600">
        Everyone counts as free unless they mark a day off. Tap the days you can't play.
      </p>

      <p className="mb-1 text-xs text-slate-600">Suggestions for the week of {weekLabel}</p>
      <SuggestedTables weekStart={iso(weekStart)} me={me} />

      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={() => setMonthOffset((m) => m - 1)}
          disabled={monthOffset === 0}
          className="rounded-lg bg-white px-3 py-2 shadow disabled:opacity-30"
        >
          ←
        </button>
        <span className="text-lg font-bold">
          {monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <button
          onClick={() => setMonthOffset((m) => m + 1)}
          disabled={monthOffset >= maxOffset}
          className="rounded-lg bg-white px-3 py-2 shadow disabled:opacity-30"
        >
          →
        </button>
      </div>

      <div className="mb-2 grid grid-cols-2 gap-1 rounded-lg bg-brand-100 p-1 text-sm font-semibold">
        {(['mark', 'view'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-md p-2 ${mode === m ? 'bg-brand-800 text-white' : 'text-brand-900'}`}
          >
            {m === 'mark' ? "Mark days I can't make" : 'Just look'}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm">Loading availability...</p>}

      <div className="grid grid-cols-7 gap-1">
        {DOW.map((d) => (
          <div key={d} className="py-1 text-center text-xs font-bold text-brand-700">
            {d}
          </div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={`blank-${i}`} />
          const key = iso(d)
          const out = !inWindow(key)
          const mine = isOff(key)
          const free = allPlayers.length - offOn(key).length
          const hasEvent = events.some((e) => e.day === key)
          return (
            <button
              key={key}
              disabled={out}
              onClick={() => tap(key)}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-lg border text-sm font-semibold ${
                out
                  ? 'border-transparent text-slate-300'
                  : mine
                    ? 'border-brand-700 bg-brand-200 text-brand-900'
                    : 'border-brand-200 bg-white'
              } ${key === selected ? 'ring-2 ring-gold' : ''}`}
            >
              <span>{d.getDate()}</span>
              {!out && (
                <span className={`text-[10px] ${mine ? 'text-brand-800' : 'text-slate-500'}`}>
                  {mine ? '✕' : free}
                </span>
              )}
              {hasEvent && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-amber-500" />
              )}
            </button>
          )
        })}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        The small number is how many players are free. ✕ means you're out. A dot marks an event.
      </p>

      <div className="mt-4 rounded-lg bg-white p-3 shadow">
        <div className="flex items-center justify-between">
          <span className="font-bold">
            {selDate.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })}
          </span>
          <span className="rounded-full bg-brand-700 px-2 py-0.5 text-xs font-semibold text-white">
            {Math.floor(freeNames.length / 4)} tables possible
          </span>
        </div>

        {selEvents.map((e) => (
          <div
            key={e.id}
            className="mt-2 flex items-center justify-between rounded-md bg-amber-100 px-2 py-1 text-sm text-amber-950"
          >
            <span>
              <b>{e.title}</b> · {e.firstName}
            </span>
            {(e.createdBy === me.id || me.isAdmin) && (
              <button
                onClick={() => removeEvent.mutate(e.id)}
                aria-label="Remove event"
                className="ml-2 font-bold"
              >
                ✕
              </button>
            )}
          </div>
        ))}

        <p className="mt-2 text-sm">
          <b>Free ({freeNames.length}):</b> {freeNames.join(', ') || 'Nobody'}
        </p>
        {offNames.length > 0 && (
          <p className="mt-1 text-sm text-slate-600">
            <b>Can't make it:</b> {offNames.join(', ')}
          </p>
        )}

        {selIn && (
          <button
            onClick={() => toggle.mutate({ day: selected, unavailable: !selMine })}
            className={`mt-3 w-full rounded-lg p-2 text-sm font-semibold ${
              selMine ? 'bg-brand-800 text-white' : 'border border-brand-300 text-brand-900'
            }`}
          >
            {selMine ? "I'm actually free this day" : "I can't make this day"}
          </button>
        )}

        {selIn &&
          (adding ? (
            <div className="mt-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                placeholder="e.g. Hosting at my place, 7pm"
                className="w-full rounded-lg border border-brand-300 p-2 text-sm"
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => setTitle('Hosting')}
                  className="rounded-lg border border-amber-300 px-3 py-1 text-xs"
                >
                  🏠 Hosting
                </button>
                <button
                  onClick={() => addEvent.mutate({ day: selected, title })}
                  disabled={!title.trim() || addEvent.isPending}
                  className="ml-auto rounded-lg bg-amber-600 px-3 py-1 text-sm font-semibold text-white disabled:opacity-40"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setAdding(false)
                    setTitle('')
                  }}
                  className="rounded-lg px-3 py-1 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => {
                setAdding(true)
                setTitle('')
                setError('')
              }}
              className="mt-2 text-sm text-amber-800 underline"
            >
              + Add an event
            </button>
          ))}
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      </div>
    </div>
  )
}