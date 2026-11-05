import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { Player } from '../Login'
import SuggestedTables from './SuggestedTables'
import { eventSchema, parseOrThrow } from '../../../shared/schemas'

type Slot = { playerId: number; firstName: string; day: string }
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
const MAX_WEEK = 8

export default function Calendar({ me }: { me: Player }) {
  const qc = useQueryClient()
  const [week, setWeek] = useState(0)
  const [adding, setAdding] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const lastDay = addDays(today, WINDOW_DAYS)
  const weekStart = addDays(mondayOf(today), week * 7)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const { data: slots = [], isLoading } = useQuery({
    queryKey: ['availability'],
    queryFn: () => api<Slot[]>('/api/availability'),
  })
  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: () => api<CalEvent[]>('/api/events'),
  })

  const toggle = useMutation({
    mutationFn: (v: { day: string; available: boolean }) =>
      api('/api/availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(v),
      }),
    // Update the screen instantly, then confirm with the server
    onMutate: async ({ day, available }) => {
      await qc.cancelQueries({ queryKey: ['availability'] })
      const previous = qc.getQueryData<Slot[]>(['availability'])
      qc.setQueryData<Slot[]>(['availability'], (old = []) =>
        available
          ? [...old, { playerId: me.id, firstName: me.firstName, day }]
          : old.filter((s) => !(s.playerId === me.id && s.day === day)),
      )
      return { previous }
    },
    onError: (_e, _v, ctx) => qc.setQueryData(['availability'], ctx?.previous),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['availability'] })
      qc.invalidateQueries({ queryKey: ['pairings'] })
    },
  })

  const addEvent = useMutation({
    mutationFn: (v: { day: string; title: string }) =>
      api('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parseOrThrow(eventSchema, v)),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] })
      setAdding(null)
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

  const label = (d: Date, opts: Intl.DateTimeFormatOptions) =>
    d.toLocaleDateString('en-US', opts)

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Calendar</h1>
      <p className="mb-3 text-sm text-slate-600">
        Tap the days you're free. See who else is free and message them to set up a table.
      </p>

      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => setWeek((w) => w - 1)}
          disabled={week === 0}
          className="rounded-lg bg-white px-3 py-2 shadow disabled:opacity-30"
        >
          ← Prev
        </button>
        <span className="font-semibold">
          {label(days[0], { month: 'short', day: 'numeric' })} –{' '}
          {label(days[6], { month: 'short', day: 'numeric' })}
        </span>
        <button
          onClick={() => setWeek((w) => w + 1)}
          disabled={week === MAX_WEEK}
          className="rounded-lg bg-white px-3 py-2 shadow disabled:opacity-30"
        >
          Next →
        </button>
      </div>

      <SuggestedTables weekStart={iso(weekStart)} me={me} />

      {error && <p className="mb-2 text-sm text-red-700">{error}</p>}
      {isLoading && <p>Loading availability...</p>}

      {days.map((d) => {
        const key = iso(d)
        const out = d < today || d > lastDay
        const free = slots.filter((s) => s.day === key)
        const dayEvents = events.filter((e) => e.day === key)
        const mine = free.some((s) => s.playerId === me.id)
        const tables = Math.floor(free.length / 4)
        return (
          <div
            key={key}
            className={`mb-2 rounded-lg bg-white p-3 shadow ${out ? 'opacity-40' : ''}`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold">
                {label(d, { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  tables > 0 ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {tables > 0
                  ? `${tables} table${tables > 1 ? 's' : ''} possible`
                  : `${free.length} free`}
              </span>
            </div>

            {dayEvents.map((e) => (
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

            <p className="mt-2 min-h-5 text-sm text-slate-700">
              {free.length ? free.map((s) => s.firstName).join(', ') : 'Nobody yet'}
            </p>

            <button
              disabled={out}
              onClick={() => toggle.mutate({ day: key, available: !mine })}
              className={`mt-2 w-full rounded-lg p-2 text-sm font-semibold ${
                mine
                  ? 'bg-brand-800 text-white'
                  : 'border border-brand-300 text-brand-900'
              }`}
            >
              {mine ? "✓ I'm free (tap to undo)" : "I'm free"}
            </button>

            {!out &&
              (adding === key ? (
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
                      onClick={() => addEvent.mutate({ day: key, title })}
                      disabled={!title.trim() || addEvent.isPending}
                      className="ml-auto rounded-lg bg-amber-600 px-3 py-1 text-sm font-semibold text-white disabled:opacity-40"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => {
                        setAdding(null)
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
                    setAdding(key)
                    setTitle('')
                    setError('')
                  }}
                  className="mt-2 text-sm text-amber-800 underline"
                >
                  + Add an event
                </button>
              ))}
          </div>
        )
      })}
    </div>
  )
}