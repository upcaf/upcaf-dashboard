import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  Card,
  EmptyState,
  ErrorBanner,
  formatDateTime,
  LoadingState,
} from './ui'

// ── Drawer dettaglio sessione ─────────────────────────────────────────────
function SessionDrawer({ session, onClose }) {
  if (!session) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* overlay */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />

      {/* pannello */}
      <div className="relative z-10 flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-xs text-slate-400">{formatDateTime(session.created_at)}</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-800">
              {session.servizio || 'Servizio non rilevato'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>
        </div>

        {/* body scrollabile */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* meta */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Cliente</p>
              <p className="mt-1 break-all text-slate-700 font-mono text-xs">{session.contact_id || '—'}</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Agente</p>
              <p className="mt-1 text-slate-700 text-xs">{session.agente_dominio || session.agente_destinatario || '—'}</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Esito QG</p>
              <p className="mt-1 text-slate-700 text-xs">{session.esito_qg || '—'}</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Tempo</p>
              <p className="mt-1 text-slate-700 text-xs">{session.ms_totali ? `${session.ms_totali} ms` : '—'}</p>
            </div>
          </div>

          {/* messaggio cliente */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Messaggio cliente
            </p>
            {session.testo_cliente ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap">
                {session.testo_cliente}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Non disponibile (sessioni precedenti all'aggiornamento)</p>
            )}
          </div>

          {/* risposta AI */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Risposta AI inviata
            </p>
            {session.testo_risposta ? (
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap">
                {session.testo_risposta}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Non disponibile (sessioni precedenti all'aggiornamento)</p>
            )}
          </div>

          {/* citazioni KB */}
          {session.citazioni_kb && session.citazioni_kb.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Citazioni KB ({session.citazioni_kb.length})
              </p>
              <div className="space-y-2">
                {session.citazioni_kb.map((c, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-2 text-xs text-slate-600 italic"
                  >
                    "{c}"
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* motivo handoff se presente */}
          {session.motivo_handoff && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Motivo handoff
              </p>
              <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {session.motivo_handoff}
              </div>
            </div>
          )}
        </div>

        {/* footer — link GHL */}
        <div className="border-t border-slate-100 px-6 py-4">
          <a
            href={`https://app.gohighlevel.com/v2/location/otZi0Yae4nEnmUzTXzOD/contacts/detail/${session.contact_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full rounded-lg bg-slate-800 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-slate-700"
          >
            Apri in GHL →
          </a>
        </div>
      </div>
    </div>
  )
}

// ── SessionsPanel principale ──────────────────────────────────────────────
export default function SessionsPanel() {
  const [sessions, setSessions] = useState([])
  const [allServices, setAllServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dateFilter, setDateFilter] = useState('')
  const [serviceFilter, setServiceFilter] = useState('')
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    if (!supabase) return
    supabase
      .from('session_logs')
      .select('servizio')
      .then(({ data }) => {
        const set = new Set((data ?? []).map((r) => r.servizio).filter(Boolean))
        setAllServices([...set].sort())
      })
  }, [])

  const load = useCallback(async () => {
    if (!supabase) {
      setError('Supabase non configurato')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    let query = supabase
      .from('session_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (dateFilter) {
      const start = new Date(`${dateFilter}T00:00:00`)
      const end = new Date(`${dateFilter}T23:59:59`)
      query = query.gte('created_at', start.toISOString()).lte('created_at', end.toISOString())
    }

    if (serviceFilter) {
      query = query.eq('servizio', serviceFilter)
    }

    const { data, error: fetchError } = await query

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setSessions(data ?? [])
    }
    setLoading(false)
  }, [dateFilter, serviceFilter])

  useEffect(() => {
    load()
  }, [load])

  // troncamento contact_id per leggibilità
  const shortId = (id) => {
    if (!id) return '—'
    if (id.length <= 12) return id
    return id.slice(0, 8) + '…' + id.slice(-4)
  }

  return (
    <>
      <Card
        title="Sessioni AI"
        action={
          <div className="flex flex-wrap gap-2">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
            />
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
            >
              <option value="">Tutti i servizi</option>
              {allServices.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        }
      >
        <ErrorBanner message={error} />

        {loading ? (
          <LoadingState />
        ) : sessions.length === 0 ? (
          <EmptyState message="Nessuna sessione trovata" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-3 pr-4 font-medium">Data</th>
                  <th className="pb-3 pr-4 font-medium">Cliente</th>
                  <th className="pb-3 pr-4 font-medium">Servizio</th>
                  <th className="pb-3 font-medium">Esito</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sessions.map((session) => (
                  <tr
                    key={session.id}
                    onClick={() => setSelected(session)}
                    className="cursor-pointer text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {formatDateTime(session.created_at)}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-slate-500">
                      {shortId(session.contact_id)}
                    </td>
                    <td className="py-3 pr-4">{session.servizio || '—'}</td>
                    <td className="py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        session.esito === 'risolto'
                          ? 'bg-emerald-100 text-emerald-800'
                          : session.esito === 'handoff'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {session.esito}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <SessionDrawer session={selected} onClose={() => setSelected(null)} />
    </>
  )
}
