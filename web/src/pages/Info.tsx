import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { Player } from '../Login'
import { TILES, Tile } from '../tiles'
import { contentSchema, parseOrThrow } from '../../../shared/schemas'
import Polls from './Polls'
import Admin from './Admin'

type Content = { rules: string; info: string; etiquette: string }

function ContentBlock({
  k,
  title,
  ordered,
  text,
  canEdit,
}: {
  k: 'rules' | 'info' | 'etiquette'
  title: string
  ordered: boolean
  text: string
  canEdit: boolean
}) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')

  const save = useMutation({
    mutationFn: () =>
      api('/api/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parseOrThrow(contentSchema, { key: k, body: draft })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['content'] })
      setEditing(false)
      setError('')
    },
    onError: (e: Error) => setError(e.message),
  })

  const items = text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  const List = ordered ? 'ol' : 'ul'

  return (
    <section className="mb-8">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-2xl font-bold">{title}</h2>
        {canEdit && !editing && (
          <button
            onClick={() => {
              setDraft(text)
              setEditing(true)
            }}
            className="text-sm text-brand-800 underline"
          >
            Edit
          </button>
        )}
      </div>
      {editing ? (
        <div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={8}
            className="w-full rounded-lg border border-brand-300 bg-white p-2 text-sm"
          />
          <p className="text-xs text-slate-500">One item per line.</p>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Save
            </button>
            <button onClick={() => setEditing(false)} className="px-3 text-sm">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <List className={`space-y-1 pl-5 ${ordered ? 'list-decimal' : 'list-disc'}`}>
          {items.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </List>
      )}
    </section>
  )
}

export default function Info({
  me,
  onUpdate,
}: {
  me: Player
  onUpdate: (p: Player) => void
}) {
  const { data: content } = useQuery({
    queryKey: ['content'],
    queryFn: () => api<Content>('/api/content'),
  })

  const setTile = useMutation({
    mutationFn: (tile: string | null) =>
      api<{ player: Player }>('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tile }),
      }),
    onSuccess: (d) => onUpdate(d.player),
  })

  return (
    <div>
      <Polls me={me} />

      {content ? (
        <>
          <ContentBlock k="rules" title="League rules" ordered text={content.rules} canEdit={me.isAdmin} />
          <ContentBlock k="info" title="Info" ordered={false} text={content.info} canEdit={me.isAdmin} />
        </>
      ) : (
        <p className="mb-8">Loading...</p>
      )}

      <section className="mb-8">
        <h2 className="mb-1 text-2xl font-bold">Tile Avatar</h2>
        <p className="mb-2 text-sm text-slate-600">Pick your favorite tile! or least fav if u r a hater</p>
        <div className="grid grid-cols-5 gap-1 rounded-lg bg-white p-2 shadow sm:grid-cols-8">
          {TILES.map((t) => (
            <button
              key={t}
              onClick={() => setTile.mutate(t)}
              aria-label="Choose tile"
              className={`rounded p-1 text-5xl leading-none ${
                me.tile === t ? 'bg-brand-200 ring-2 ring-brand-700' : ''
              }`}
            >
              <Tile t={t} />
            </button>
          ))}
        </div>
        {me.tile && (
          <button
            onClick={() => setTile.mutate(null)}
            className="mt-2 text-sm text-slate-600 underline"
          >
            Remove my tile
          </button>
        )}
      </section>
      {content && (
        <ContentBlock
          k="etiquette"
          title="Etiquette"
          ordered={false}
          text={content.etiquette ?? ''}
          canEdit={me.isAdmin}
        />
      )}
      {me.isAdmin && <Admin />}
    </div>
  )
}