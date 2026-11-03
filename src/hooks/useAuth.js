import { useCallback, useState } from 'react'
import { GATEWAY_LOGIN_URL, clearToken, getToken, setToken } from '../lib/gatewayAuth'

// La password non sta più nella dashboard (finiva nel codice pubblico): si controlla sul gateway.
export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!getToken())

  const login = useCallback(async (password) => {
    try {
      const res = await fetch(GATEWAY_LOGIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.token) {
        return { ok: false, error: data.error || 'Accesso non riuscito (HTTP ' + res.status + ')' }
      }
      setToken(data.token)
      setIsAuthenticated(true)
      return { ok: true }
    } catch {
      return { ok: false, error: 'Gateway non raggiungibile' }
    }
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setIsAuthenticated(false)
  }, [])

  return { isAuthenticated, login, logout }
}
