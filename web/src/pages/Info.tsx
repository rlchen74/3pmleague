import { useMutation } from '@tanstack/react-query'
import { api } from '../api'
import type { Player } from '../Login'
import { TILES, Tile } from '../tiles'
import Polls from './Polls'

// EDIT THESE: replace with your league's real rules and info
const RULES = [
  'We play Hong Kong mahjong with the league house rules.',
  'Each player plays 5 league games, always against opponents they have not faced.',
  'Standings are the sum of your scores across counting games.',
  'Report scores on the Scoring tab right after your game.',
]
const INFO = [
  'Organizer: add your name and contact here.',
  'Games are self-scheduled. Use the Calendar tab to find people and tables.',
]

export default function Info({
  me,
  onUpdate,
}: {
  me: Player
  onUpdate: (p: Player) => void
}) {
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

      <section className="mb-8">
        <h2 className="mb-2 text-2xl font-bold">League rules</h2>
        <ol className="list-decimal space-y-1 pl-5">
          {RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ol>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-2xl font-bold">Info</h2>
        <ul className="list-disc space-y-1 pl-5">
          {INFO.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-1 text-2xl font-bold">Your profile</h2>
        <p className="mb-2 text-sm text-slate-600">
          Pick a tile to show next to your name.
        </p>
        <div className="grid grid-cols-6 gap-1 rounded-lg bg-white p-2 shadow sm:grid-cols-8">
            {TILES.map((t) => (
                <button
                key={t}
                onClick={() => setTile.mutate(t)}
                aria-label="Choose tile"
                className={`rounded p-1 text-3xl leading-none ${
                    me.tile === t ? 'bg-emerald-200 ring-2 ring-emerald-700' : ''
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
    </div>
  )
}