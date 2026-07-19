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
  { value: '', label: 'Seleziona agente…' },
  { value: 'AGENTE_CAF', label: 'CAF — 730 / ISEE / PF' },
  { value: 'AGENTE_PATRONATO', label: 'Patronato — NASPi / Pensioni' },
  { value: 'AGENTE_CONSULENZE', label: 'Consulenze — Successioni / Dimissioni' },
]

export default function KbQueryPanel() {
  const [query, setQuery] = useState('')
  const [agente, setAgente] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  async function handleSubmit() {
    if (!query.trim() || !agente) return
    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const res = await fetch(`${GATEWAY_URL}/operatore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaggio: query, agente_dominio: agente }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(
          data.error || data.message || `Errore gateway (${res.status})`,
        )
      }
      setResult(
        data.risposta ?? data.testo_operatore ?? JSON.stringify(data, null, 2),
      )
    } catch (e) {
      setError(e.message || 'Errore di connessione al gateway.')
    } finally {
      setLoading(false)
    }
  }

  const canSend = query.trim().length > 0 && agente !== ''

  return (
    <Card label="Query KB">
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
            {result}
          </p>
        </div>
      )}
    </Card>
  )
}
