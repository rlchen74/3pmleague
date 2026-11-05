import { useEffect, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import Login, { type Player } from './Login'
import Standings from './pages/Standings'
import Scoring from './pages/Scoring'
import Calendar from './pages/Calendar'
import Info from './pages/Info'
import { Tile } from './tiles'
import { api } from './api'

const tabs = [
  { to: '/', label: 'Info' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/standings', label: 'Standings' },
  { to: '/scoring', label: 'Scoring' },
]

export default function App() {
  const [player, setPlayer] = useState<Player | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
  api<{ player: Player | null }>('/api/me')
    .then((d) => setPlayer(d.player))
    .catch(() => setPlayer(null))
    .finally(() => setLoading(false))
}, [])

async function logout() {
  await api('/api/logout', { method: 'POST' })
  setPlayer(null)
}

  if (loading || !player) {
    return (
      <main className="grid min-h-screen place-items-center bg-emerald-900 p-6 text-white">
        {loading ? <p>Loading...</p> : <Login onLogin={setPlayer} />}
      </main>
    )
  }

  return (
    <div className="min-h-screen bg-emerald-50 pb-20 text-emerald-950">
      <header className="flex items-center justify-between bg-emerald-900 px-4 py-3 text-white">
        <span className="font-bold">Mahjong League</span>
        <button onClick={logout} className="text-sm text-emerald-200 underline">
          {player.tile && <Tile t={player.tile} />} {player.firstName} · switch
        </button>
      </header>
      <div className="mx-auto max-w-2xl p-4">
        <Routes>
          <Route path="/" element={<Info me={player} onUpdate={setPlayer} />} />
          <Route path="/calendar" element={<Calendar me={player} />} />
          <Route path="/standings" element={<Standings />} />
          <Route path="/scoring" element={<Scoring me={player} />} />
          
        </Routes>
      </div>
      <nav className="fixed inset-x-0 bottom-0 grid grid-cols-4 border-t border-emerald-200 bg-white">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end
            className={({ isActive }) =>
              `p-3 text-center text-sm font-semibold ${
                isActive ? 'bg-emerald-100 text-emerald-900' : 'text-slate-500'
              }`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}