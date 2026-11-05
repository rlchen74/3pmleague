import { useEffect, useState } from 'react'
import { Turnstile } from '@marsidev/react-turnstile'
import { api } from './api'

export interface Player {
  id: number
  firstName: string
  tile: string | null
  isAdmin: boolean
}

export default function Login({ onLogin }: { onLogin: (p: Player) => void }) {
  const [names, setNames] = useState<{ id: number; firstName: string }[]>([])
  const [playerId, setPlayerId] = useState('')
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
  api<{ id: number; firstName: string; isActive: boolean }[]>('/api/players')
    .then((rows) => setNames(rows.filter((r) => r.isActive)))
    .catch(() => setError('Could not load players (the server may be waking up)'))
}, [])

  async function submit() {
  setBusy(true)
  setError('')
  try {
    const data = await api<{ player: Player }>('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: Number(playerId), turnstileToken: token }),
    })
    onLogin(data.player)
  } catch (e) {
    setError((e as Error).message)
  }
  setBusy(false)
}

  return (
    <div className="w-full max-w-sm rounded-xl bg-white p-6 text-brand-950 shadow-lg">
      <h2 className="text-xl font-bold">Who are you?</h2>
      <select
        value={playerId}
        onChange={(e) => setPlayerId(e.target.value)}
        className="mt-4 w-full rounded-lg border border-brand-300 p-3"
      >
        <option value="">Select your name...</option>
        {names.map((n) => (
          <option key={n.id} value={n.id}>
            {n.firstName}
          </option>
        ))}
      </select>

      <div className="mt-4">
        <Turnstile
          siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
          onSuccess={setToken}
        />
      </div>

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      <button
        onClick={submit}
        disabled={!playerId || !token || busy}
        className="mt-4 w-full rounded-lg bg-brand-800 p-3 font-semibold text-white disabled:opacity-40"
      >
        {busy ? 'Entering...' : 'Enter'}
      </button>
    </div>
  )
}