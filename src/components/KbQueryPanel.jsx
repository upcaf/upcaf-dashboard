// src/components/panels/KbQueryPanel.jsx
// v2 — fix campo body: "messaggio" → "query" (backend restituiva '"query" obbligatoria')
// Aggiunta visualizzazione citazioni_kb nella risposta.

import { useState } from 'react'
import {
  btnPrimary,
  Card,
  ErrorBanner,
  inputBase,
  rowSub,
  rowText,
  sectionLabel,
} from '../ui'

const GATEWAY_URL =
  import.meta.env.VITE_GATEWAY_URL ||
  'https://gateway-production-a488.up.railway.app'

const AGENTI = [
  { value: '',                   label: 'Seleziona agente…'                   },
  { value: 'AGENTE_CAF',         label: 'CAF — 730 / ISEE / PF'               },
  { value: 'AGENTE_PATRONATO',   label: 'Patronato — NASPi / Pensioni'         },
  { value: 'AGENTE_CONSULENZE',  label: 'Consulenze — Successioni / Dimissioni' },
]

export default function KbQueryPanel() {
  const [query,   setQuery]   = useState('')
  const [agente,  setAgente]  = useState('')
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState(null)
  const [error,   setError]   = useState(null)
  const [citOpen, setCitOpen] = useState(false)

  async function handleSubmit() {
    if (!query.trim() || !agente) return
    setLoading(true)
    setResult(null)
    setError(null)
    setCitOpen(false)

    try {
      const res = await fetch(`${GATEWAY_URL}/operatore`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        // FIX: il backend si aspetta "query", non "messaggio"
        body: JSON.stringify({ query: query.trim(), agente_dominio: agente }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(
          data.error || data.message || `Errore gateway (${res.status})`,
        )
      }
      setResult(data)
    } catch (e) {
      setError(e.message || 'Errore di connessione al gateway.')
    } finally {
      setLoading(false)
    }
  }

  const canSend = query.trim().length > 0 && agente !== ''

  // Estrai testo risposta (può trovarsi in campi diversi a seconda del percorso)
  const rispostaText =
    result?.risposta        ??
    result?.testo_operatore ??
    result?.testo_cliente   ??
    (result ? JSON.stringify(result, null, 2) : null)

  // Citazioni KB
  const raw = result?.citazioni_kb ?? []
  const citazioni = Array.isArray(raw) ? raw : [raw].filter(Boolean)

  return (
    <Card label="Consulente AI KB">
      <input
        className={inputBase}
        type="text"
        placeholder='Es. "Termini di decadenza NASPi per dimissioni volontarie"'
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && canSend && handleSubmit()}
        aria-label="Testo della query KB"
      />

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          className={btnPrimary}
          onClick={handleSubmit}
          disabled={!canSend || loading}
          aria-busy={loading}
        >
          {loading ? 'Invio…' : 'Invia query'}
        </button>
        <select
          className={`${inputBase} ml-auto w-auto min-w-[200px]`}
          value={agente}
          onChange={(e) => setAgente(e.target.value)}
          aria-label="Seleziona agente di dominio"
        >
          {AGENTI.map(({ value, label }) => (
            <option key={value || 'empty'} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <ErrorBanner message={error} />

      {result && (
        <div
          className="border-t border-uc-border pt-3"
          role="region"
          aria-label="Risposta KB"
        >
          <p className={`${sectionLabel} mb-2`}>Risposta</p>
          <p className={`${rowText} whitespace-pre-wrap leading-relaxed`}>
            {rispostaText}
          </p>

          {/* Citazioni KB — visibili solo se presenti */}
          {citazioni.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setCitOpen((o) => !o)}
                className="text-xs font-medium text-blue-600 hover:underline"
              >
                {citOpen
                  ? '▲ nascondi citazioni'
                  : `▼ ${citazioni.length} citazion${citazioni.length === 1 ? 'e' : 'i'} KB`}
              </button>
              {citOpen && (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {citazioni.map((c, i) => (
                    <li
                      key={i}
                      className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs italic text-emerald-800"
                    >
                      "{c}"
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
