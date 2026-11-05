const BASE = import.meta.env.VITE_API_URL ?? ''

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(BASE + url, { credentials: 'include', ...init })
  const data = await r.json().catch(() => null)
  if (!r.ok) throw new Error(data?.error ?? 'Request failed')
  return data as T
}