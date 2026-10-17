const API_URL = import.meta.env.VITE_API_URL?.replace(/\/+$/, '')

export async function apiRequest(path, options = {}) {
  if (!API_URL) {
    throw new Error('The API URL is not configured. Set VITE_API_URL in the frontend environment.')
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  })

  const contentType = response.headers.get('content-type') || ''
  const body = response.status === 204
    ? null
    : contentType.includes('application/json')
      ? await response.json()
      : null

  if (!response.ok) throw new Error(body?.message || 'Something went wrong')
  return body
}

export function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {}
}
