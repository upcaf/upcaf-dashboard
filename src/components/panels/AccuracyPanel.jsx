// src/components/AccuracyPanel.jsx
// Gamba 1 — Metrica accuratezza normativa
// Versione: 1.0 — 23 luglio 2026
//
// Legge session_logs e calcola:
// - % risposte con citazioni_kb verificate (denominatore onesto)
// - totale sessioni con agente di dominio
// - totale con citazioni presenti
// - totale handoff (non scaricati dal denominatore — denominatore onesto)

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Card, ErrorBanner, LoadingState } from '../ui'

function MetricBox({ label, value, sub, color = 'slate' }) {
  const colors = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    blue:    'bg-blue-50 border-blue-200 text-blue-800',
    amber:   'bg-amber-50 border-amber-200 text-amber-800',
    slate:   'bg-slate-50 border-slate-200 text-slate-800',
  }
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="mt-1 text-sm font-medium">{label}</div>
      {sub && <div className="mt-0.5 text-xs opacity-70">{sub}</div>}
    </div>
  )
}

function CitazioniRow({ session }) {
  const [open, setOpen] = useState(false)
  const cit = session.citazioni_kb

  if (!cit || (Array.isArray(cit) && cit.length === 0)) return null

  const lista = Array.isArray(cit) ? cit : [cit]

  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-blue-600 hover:underline"
      >
        {open ? '▲ nascondi' : `▼ ${lista.length} citazion${lista.length === 1 ? 'e' : 'i'} KB`}
      </button>
      {open && (
        <ul className="mt-1 space-y-1">
          {lista.map((c, i) => (
            <li key={i} className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700 italic">
              "{c}"
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function AccuracyPanel() {
  const [stats, setStats]   = useState(null)
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)
  const [days, setDays]     = useState(7)

  const load = useCallback(async () => {
    if (!supabase) { setError('Supabase non configurato'); setLoading(false); return }
    setLoading(true)
    setError(null)

    const since = new Date(Date.now() - days * 86400000).toISOString()

    // Solo sessioni con agente di dominio (CAF / Patronato / Consulenze)
    // — sono le uniche che passano dal grounding e producono citazioni_kb
    const { data, error: fetchError } = await supabase
      .from('session_logs')
      .select('id, created_at, contact_id, servizio, esito, agente_dominio, testo_risposta, citazioni_kb')
      .in('agente_dominio', ['AGENTE_CAF', 'AGENTE_PATRONATO', 'AGENTE_CONSULENZE'])
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(200)

    if (fetchError) { setError(fetchError.message); setLoading(false); return }

    const rows = data ?? []

    // Denominatore onesto: TUTTE le sessioni con agente di dominio
    // (incluse handoff — non le scartiamo per gonfiare la metrica)
    const totale = rows.length

    // Con citazioni effettive
    const conCitazioni = rows.filter(r => {
      const c = r.citazioni_kb
      if (!c) return false
      if (Array.isArray(c)) return c.length > 0
      if (typeof c === 'string') return c.trim().length > 0
      return false
    }).length

    // Handoff (per trasparenza — mostrati separatamente)
    const handoff = rows.filter(r => r.esito === 'handoff').length

    const pct = totale > 0 ? Math.round((conCitazioni / totale) * 100) : null

    setStats({ totale, conCitazioni, handoff, pct })
    setRecent(rows.slice(0, 20))
    setLoading(false)
  }, [days])

  useEffect(() => { load() }, [load])

  const pctColor = stats?.pct >= 80 ? 'emerald' : stats?.pct >= 60 ? 'amber' : 'slate'

  return (
    <Card
      title="Accuratezza normativa — Gamba 1"
      action={
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
          >
            <option value={7}>Ultimi 7 giorni</option>
            <option value={14}>Ultimi 14 giorni</option>
            <option value={30}>Ultimi 30 giorni</option>
          </select>
          <button
            onClick={load}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Aggiorna
          </button>
        </div>
      }
    >
      <ErrorBanner message={error} />

      {loading ? <LoadingState /> : !stats ? null : (
        <>
          {/* Metriche aggregate */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
            <MetricBox
              label="Accuratezza"
              value={stats.pct !== null ? `${stats.pct}%` : '—'}
              sub="dati verificati vs KB"
              color={pctColor}
            />
            <MetricBox
              label="Sessioni totali"
              value={stats.totale}
              sub="con agente di dominio"
              color="blue"
            />
            <MetricBox
              label="Con citazioni KB"
              value={stats.conCitazioni}
              sub="grounding verificabile"
              color="emerald"
            />
            <MetricBox
              label="Handoff"
              value={stats.handoff}
              sub="inclusi nel denominatore"
              color="amber"
            />
          </div>

          {/* Nota metodologica */}
          <p className="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            <strong>Denominatore onesto:</strong> include tutte le sessioni con agente di dominio,
            anche quelle finite in handoff. Un sistema che va sempre in handoff avrebbe 0% — non 100%.
          </p>

          {/* Tabella sessioni recenti */}
          {recent.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nessuna sessione con agente di dominio nel periodo. I dati si accumulano
              con il traffico live — i record storici non hanno citazioni_kb.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                    <th className="pb-3 pr-4 font-medium">Data</th>
                    <th className="pb-3 pr-4 font-medium">Servizio</th>
                    <th className="pb-3 pr-4 font-medium">Agente</th>
                    <th className="pb-3 pr-4 font-medium">Esito</th>
                    <th className="pb-3 font-medium">Citazioni KB</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {recent.map(s => {
                    const hasCit = s.citazioni_kb &&
                      (Array.isArray(s.citazioni_kb) ? s.citazioni_kb.length > 0 : true)
                    return (
                      <tr key={s.id} className="text-slate-700 align-top">
                        <td className="py-3 pr-4 whitespace-nowrap text-xs text-slate-500">
                          {new Date(s.created_at).toLocaleString('it-IT', {
                            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                          })}
                        </td>
                        <td className="py-3 pr-4">{s.servizio || '—'}</td>
                        <td className="py-3 pr-4 text-xs text-slate-500">
                          {s.agente_dominio?.replace('AGENTE_', '') || '—'}
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            s.esito === 'handoff'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {s.esito}
                          </span>
                        </td>
                        <td className="py-3">
                          {hasCit ? (
                            <CitazioniRow session={s} />
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
