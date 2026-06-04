// Trading API client for the dashboard-in-hub.
//
// The trading views were written to hit the trading server same-origin
// (fetch('/monitor')). In the hub they instead go through the Clerk-secured
// passthrough on the hub backend: /trading/raw/<path>. tfetch is a drop-in for
// fetch — same signature, returns a real Response — so the views' existing
// `const r = await tfetch(...); const d = await r.json()` code is unchanged
// apart from the function name.

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export async function tfetch(path, options = {}) {
  const rel = path.startsWith('/') ? path : `/${path}`
  const url = `${API_BASE}/trading/raw${rel}`

  let token
  try {
    token = await window.Clerk?.session?.getToken()
  } catch {
    /* Clerk not ready — request goes out unauthenticated and the backend 401s */
  }

  const headers = { ...(options.headers || {}) }
  if (token) headers.Authorization = `Bearer ${token}`

  return fetch(url, { ...options, headers })
}
