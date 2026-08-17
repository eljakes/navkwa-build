const API_BASE = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '')
const TOKEN_KEY = 'navkwabuild_portal_session'

export function portalToken(value) {
  if (value === undefined) return window.sessionStorage?.getItem(TOKEN_KEY) || null
  if (value) window.sessionStorage?.setItem(TOKEN_KEY, value)
  else window.sessionStorage?.removeItem(TOKEN_KEY)
  return value
}

async function call(path, options = {}) {
  const isForm = options.body instanceof FormData
  const response = await fetch(`${API_BASE}/portal${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(portalToken() ? { Authorization: `Bearer ${portalToken()}` } : {}),
      ...(options.headers || {}),
    },
  })
  const payload = (response.headers.get('content-type') || '').includes('json') ? await response.json() : null
  if (!response.ok) {
    const error = new Error(payload?.message || 'Request failed')
    error.status = response.status
    error.errors = payload?.errors || {}
    throw error
  }
  return payload
}

const json = (method, body) => ({ method, body: JSON.stringify(body) })

export const portalApi = {
  accept: (body) => call('/auth/accept', json('POST', body)),
  login: (body) => call('/auth/login', json('POST', body)),
  forgot: (body) => call('/auth/forgot-password', json('POST', body)),
  reset: (body) => call('/auth/reset-password', json('POST', body)),
  logout: () => call('/auth/logout', { method: 'POST' }),
  workspace: () => call('/workspace'),
  submitWorkItem: (body) => call('/work-items', { method: 'POST', body }),
  respondWorkItem: (id, body) => call(`/work-items/${id}/respond`, { method: 'POST', body }),
  reviewApproval: (id, body) => call(`/client-approvals/${id}/review`, json('POST', body)),
  sendMessage: (body) => call('/messages', { method: 'POST', body }),
  submitPayment: (body) => call('/payments', { method: 'POST', body }),
  setupMfa: () => call('/security/mfa/setup', { method: 'POST' }),
  enableMfa: (code) => call('/security/mfa/enable', json('POST', { code })),
}
