import { useCallback, useEffect, useState } from 'react'

const AUTH_KEY = 'upcaf_admin_auth'

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => sessionStorage.getItem(AUTH_KEY) === 'true',
  )

  const login = useCallback((password) => {
    const expected = import.meta.env.VITE_ADMIN_PASSWORD
    if (!expected) {
      return { ok: false, error: 'VITE_ADMIN_PASSWORD non configurata' }
    }
    if (password === expected) {
      sessionStorage.setItem(AUTH_KEY, 'true')
      setIsAuthenticated(true)
      return { ok: true }
    }
    return { ok: false, error: 'Password non valida' }
  }, [])

  const logout = useCallback(() => {
    sessionStorage.removeItem(AUTH_KEY)
    setIsAuthenticated(false)
  }, [])

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === AUTH_KEY) {
        setIsAuthenticated(e.newValue === 'true')
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return { isAuthenticated, login, logout }
}
