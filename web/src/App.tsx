import { useEffect, useState } from 'react'
import Login, { type Player } from './Login'

export default function App() {
  const [player, setPlayer] = useState<Player | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((d) => setPlayer(d.player))
      .finally(() => setLoading(false))
  }, [])

  async function logout() {
    await fetch('/api/logout', { method: 'POST' })
    setPlayer(null)
  }

  return (
    <main className="grid min-h-screen place-items-center bg-emerald-900 p-6 text-white">
      {loading ? (
        <p>Loading...</p>
      ) : player ? (
        <div className="text-center">
          <h1 className="text-3xl font-bold">Welcome, {player.firstName}</h1>
          <button onClick={logout} className="mt-4 underline text-emerald-200">
            Not you? Switch player
          </button>
        </div>
      ) : (
        <Login onLogin={setPlayer} />
      )}
    </main>
  )
}