export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init)
  const data = await r.json().catch(() => null)
  if (!r.ok) throw new Error(data?.error ?? 'Request failed')
  return data as T
}