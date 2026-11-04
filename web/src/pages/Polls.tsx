import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { Player } from '../Login'

type Poll = {
  id: number
  question: string
  createdBy: number
  myVote: number | null
  options: { id: number; label: string; voters: string[] }[]
}

const input = 'w-full rounded-lg border border-emerald-300 bg-white p-2 text-sm'

export default function Polls({ me }: { me: Player }) {
  const qc = useQueryClient()
  const { data: polls = [], isLoading } = useQuery({
    queryKey: ['polls'],
    queryFn: () => api<Poll[]>('/api/polls'),
  })
  const [creating, setCreating] = useState(false)
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [error, setError] = useState('')

  const refresh = () => qc.invalidateQueries({ queryKey: ['polls'] })

  const vote = useMutation({
    mutationFn: (v: { pollId: number; optionId: number }) =>
      api(`/api/polls/${v.pollId}/vote`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionId: v.optionId }),
      }),
    onSuccess: refresh,
    onError: (e: Error) => setError(e.message),
  })

  const create = useMutation({
    mutationFn: () =>
      api('/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, options: options.filter((o) => o.trim()) }),
      }),
    onSuccess: () => {
      setCreating(false)
      setQuestion('')
      setOptions(['', ''])
      setError('')
      refresh()
    },
    onError: (e: Error) => setError(e.message),
  })

  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/polls/${id}`, { method: 'DELETE' }),
    onSuccess: refresh,
    onError: (e: Error) => setError(e.message),
  })

  return (
    <section className="mb-8">
      <h2 className="mb-2 text-2xl font-bold">Polls</h2>
      {isLoading && <p>Loading polls...</p>}
      {!isLoading && polls.length === 0 && (
        <p className="text-sm text-slate-600">No polls yet. Start one below.</p>
      )}

      {polls.map((p) => {
        const total = p.options.reduce((s, o) => s + o.voters.length, 0)
        return (
          <div key={p.id} className="mb-3 rounded-lg bg-white p-3 shadow">
            <div className="flex justify-between gap-2">
              <p className="font-semibold">{p.question}</p>
              {(p.createdBy === me.id || me.isAdmin) && (
                <button
                  onClick={() => confirm('Delete this poll?') && remove.mutate(p.id)}
                  className="shrink-0 text-xs text-red-700 underline"
                >
                  Delete
                </button>
              )}
            </div>
            {p.options.map((o) => {
              const pct = total ? Math.round((o.voters.length / total) * 100) : 0
              const mine = p.myVote === o.id
              return (
                <button
                  key={o.id}
                  onClick={() => vote.mutate({ pollId: p.id, optionId: o.id })}
                  className={`relative mt-2 block w-full overflow-hidden rounded-lg border p-2 text-left text-sm ${
                    mine ? 'border-emerald-700' : 'border-emerald-200'
                  }`}
                >
                  <span
                    className="absolute inset-y-0 left-0 bg-emerald-100"
                    style={{ width: `${pct}%` }}
                  />
                  <span className="relative flex justify-between">
                    <span className={mine ? 'font-bold' : ''}>
                      {mine && '✓ '}
                      {o.label}
                    </span>
                    <span>{o.voters.length}</span>
                  </span>
                  {o.voters.length > 0 && (
                    <span className="relative block text-xs text-slate-600">
                      {o.voters.join(', ')}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )
      })}

      {error && <p className="mb-2 text-sm text-red-700">{error}</p>}

      {creating ? (
        <div className="rounded-lg bg-white p-3 shadow">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={120}
            placeholder="Poll question"
            className={input}
          />
          {options.map((o, i) => (
            <input
              key={i}
              value={o}
              onChange={(e) =>
                setOptions((os) => os.map((x, j) => (j === i ? e.target.value : x)))
              }
              maxLength={60}
              placeholder={`Option ${i + 1}`}
              className={`${input} mt-2`}
            />
          ))}
          {options.length < 6 && (
            <button
              onClick={() => setOptions((os) => [...os, ''])}
              className="mt-2 text-sm text-emerald-800 underline"
            >
              + Add option
            </button>
          )}
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => create.mutate()}
              disabled={!question.trim() || create.isPending}
              className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Create poll
            </button>
            <button onClick={() => setCreating(false)} className="px-3 text-sm">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-900"
        >
          + New poll
        </button>
      )}
    </section>
  )
}