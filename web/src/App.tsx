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
      <main className="grid min-h-screen place-items-center bg-brand-900 p-6 text-white">
        {loading ? <p>Loading...</p> : <Login onLogin={setPlayer} />}
      </main>
    )
  }

  return (
    <div className="min-h-screen bg-brand-50 pb-20 text-brand-950">
      <header className="flex items-center justify-between bg-linear-to-r from-brand-900 via-brand-800 to-brand-600 px-4 py-3 text-white shadow">
        <span className="text-xl font-extrabold tracking-tight">
          <span className="text-gold">三PM</span> Mahjong League
        </span>
        <button onClick={logout} className="flex items-center gap-2 text-sm text-brand-100">
          {player.tile && (
            <Tile
              t={player.tile}
              className="inline-block shrink-0 rounded-md bg-brand-50 px-1 text-4xl leading-none text-brand-900"
            />
          )}
          <span className="text-left leading-tight">
            {player.firstName}
            <br />
            <span className="underline">switch</span>
          </span>
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
      <nav className="fixed inset-x-0 bottom-0 grid grid-cols-4 border-t border-brand-200 bg-white">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end
            className={({ isActive }) =>
              `p-3 text-center text-sm font-semibold ${
                isActive ? 'bg-brand-100 text-brand-900' : 'text-slate-500'
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