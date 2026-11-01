// src/components/panels/AppuntamentiPanel.jsx
// Appuntamenti dal Google Calendar di UP CAF (sola lettura, via gateway /appuntamenti).
// Versione 1.0 — 1 novembre 2026. Prossimo passo: nota vocale + riassunto per appuntamento.
// Regola Vite 8: zero template literal nel JSX — solo concatenazioni.

import { useCallback, useEffect, useState } from 'react'
import { Card, EmptyState, ErrorBanner, LoadingState } from '../ui'

const GATEWAY_URL = 'https://gateway-production-4696.up.railway.app'

function giornoChiave(iso) {
  return new Date(iso).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
}

function oraDi(iso) {
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

export default function AppuntamentiPanel() {
  const [lista, setLista] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(GATEWAY_URL + '/appuntamenti')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status)
      setLista(data.appuntamenti || [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 120000)
    return () => clearInterval(t)
  }, [load])

  const gruppi = []
  for (const ev of lista) {
    const k = giornoChiave(ev.start)
    const ultimo = gruppi[gruppi.length - 1]
    if (ultimo && ultimo.k === k) ultimo.eventi.push(ev)
    else gruppi.push({ k, eventi: [ev] })
  }

  return (
    <Card
      title="Appuntamenti"
      action={
        <button
          onClick={load}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          ↺
        </button>
      }
    >
      <ErrorBanner message={error} />
      {loading ? (
        <LoadingState />
      ) : lista.length === 0 && !error ? (
        <EmptyState message="Nessun appuntamento nei prossimi giorni" />
      ) : (
        <div className="flex flex-col gap-4">
          {gruppi.map((g) => (
            <div key={g.k} className="flex flex-col gap-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{g.k}</h3>
              {g.eventi.map((ev) => (
                <div key={ev.uid} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-800">{ev.titolo}</span>
                    <span className="shrink-0 text-xs text-slate-500">
                      {ev.giornata_intera ? 'tutto il giorno' : oraDi(ev.start) + '–' + oraDi(ev.end)}
                    </span>
                  </div>
                  {ev.luogo && <p className="mt-0.5 text-xs text-slate-500">{ev.luogo}</p>}
                  {ev.descrizione && (
                    <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{ev.descrizione}</p>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
