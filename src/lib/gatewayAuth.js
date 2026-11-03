// src/lib/gatewayAuth.js — v1.0 (3 novembre 2026)
// Il gateway è protetto da password: dopo il login la dashboard riceve un token
// e lo aggiunge a ogni chiamata verso Railway (senza toccare i singoli pannelli).
const TOKEN_KEY = 'upcaf_gw_token'

export const GATEWAY_LOGIN_URL =
  (import.meta.env.VITE_GATEWAY_URL || 'https://gateway-production-4696.up.railway.app') + '/auth/login'

export function getToken() {
  try {
    const t = localStorage.getItem(TOKEN_KEY)
    if (!t) return null
    const exp = Number(t.split('.')[0])
    if (!exp || exp < Date.now()) { localStorage.removeItem(TOKEN_KEY); return null }
    return t
  } catch {
    return null
  }
}

export function setToken(t) {
  try { localStorage.setItem(TOKEN_KEY, t) } catch { /* storage bloccato */ }
}

export function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY) } catch { /* storage bloccato */ }
}

function eGateway(url) {
  try {
    return new URL(url, window.location.href).hostname.endsWith('.up.railway.app')
  } catch {
    return false
  }
}

export function installFetchAuth() {
  const originale = window.fetch.bind(window)
  window.fetch = (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url
    if (!eGateway(url)) return originale(input, init)
    const t = getToken()
    let nuovoInit = init
    if (t) {
      const h = new Headers(init.headers || (typeof input === 'string' ? undefined : input.headers))
      h.set('Authorization', 'Bearer ' + t)
      nuovoInit = { ...init, headers: h }
    }
    return originale(input, nuovoInit).then((res) => {
      // sessione scaduta o password cambiata: torno alla schermata di accesso
      if (res.status === 401 && !url.includes('/auth/login')) {
        clearToken()
        window.location.reload()
      }
      return res
    })
  }
}
