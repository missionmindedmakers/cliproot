import { LocalStorageTokenStore } from '@cliproot/registry-client'

/**
 * Check if the current URL contains an OAuth callback token and store it.
 * Returns true if a callback was handled.
 */
export function handleOAuthCallback(): boolean {
  const params = new URLSearchParams(window.location.search)
  if (params.get('auth') !== 'callback') return false

  const token = params.get('token')
  if (token) {
    const store = new LocalStorageTokenStore()
    store.setToken(token).catch(() => {})
  }

  // Clean URL
  const url = new URL(window.location.href)
  url.searchParams.delete('auth')
  url.searchParams.delete('token')
  window.history.replaceState({}, '', url.pathname + url.search)

  return true
}
