import { useEffect, useState } from 'react'

export default function App() {
  const [status, setStatus] = useState('checking the API...')

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setStatus(`API is up (${d.time})`))
      .catch(() => setStatus('API not reachable'))
  }, [])

  return (
    <main className="min-h-screen grid place-items-center bg-emerald-900 p-6 text-white">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Mahjong League</h1>
        <p className="mt-2 text-emerald-200">{status}</p>
      </div>
    </main>
  )
}