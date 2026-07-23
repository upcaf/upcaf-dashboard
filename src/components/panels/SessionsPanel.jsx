import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  btnPrimary,
  Card,
  EmptyState,
  ErrorBanner,
  formatDateTime,
  inputBase,
  LoadingState,
  pillClass,
  rowSub,
  sectionLabel,
} from '../ui'

const ESITO_VARIANT = {
  risolto: 'green',
  errore: 'red',
  handoff: 'amber',
}

const GHL_LOCATION_ID = 'otZi0Yae4nEnmUzTXzOD'

function shortId(id) {
  if (!id) return '—'
  if (id.length <= 12) return id
  return id.slice(0, 8) + '…' + id.slice(-4)
}

function SessionDrawer({ session, onClose }) {
  if (!session) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      <div className="relative z-10 flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-uc-border px-6 py-4">
          <div>
            <p className={rowSub}>{formatDateTime(session.created_at)}</p>
            <p className="mt-0.5 text-sm font-semibold text-uc-ink">
              {session.servizio || 'Servizio non rilevato'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-uc-muted hover:bg-uc-canvas hover:text-uc-ink"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-uc-canvas px-4 py-3">
              <p className={sectionLabel}>Cliente</p>
              <p className="mt-1 break-all font-mono text-xs text-uc-ink">
                {session.contact_id || '—'}
              </p>
            </div>
            <div className="rounded-lg bg-uc-canvas px-4 py-3">
              <p className={sectionLabel}>Agente</p>
              <p className="mt-1 text-xs text-uc-ink">
                {session.agente_dominio || session.agente_destinatario || '—'}
              </p>
            </div>
            <div className="rounded-lg bg-uc-canvas px-4 py-3">
              <p className={sectionLabel}>Esito QG</p>
              <p className="mt-1 text-xs text-uc-ink">{session.esito_qg || '—'}</p>
            </div>
            <div className="rounded-lg bg-uc-canvas px-4 py-3">
              <p className={sectionLabel}>Tempo</p>
              <p className="mt-1 text-xs text-uc-ink">
                {session.ms_totali ? `${session.ms_totali} ms` : '—'}
              </p>
            </div>
          </div>

          <div>
            <p className={`${sectionLabel} mb-2`}>Messaggio cliente</p>
            {session.testo_cliente ? (
              <div className="whitespace-pre-wrap rounded-lg border border-uc-border bg-uc-canvas px-4 py-3 text-sm text-uc-ink">
                {session.testo_cliente}
              </div>
            ) : (
              <p className="text-xs italic text-uc-muted">
                Non disponibile (sessioni precedenti all'aggiornamento)
              </p>
            )}
          </div>

          <div>
            <p className={`${sectionLabel} mb-2`}>Risposta AI inviata</p>
            {session.testo_risposta ? (
              <div className="whitespace-pre-wrap rounded-lg border border-uc-border bg-[rgba(0,166,61,0.06)] px-4 py-3 text-sm text-uc-ink">
                {session.testo_risposta}
              </div>
            ) : (
              <p className="text-xs italic text-uc-muted">
                Non disponibile (sessioni precedenti all'aggiornamento)
              </p>
            )}
          </div>

          {session.citazioni_kb && session.citazioni_kb.length > 0 && (
            <div>
              <p className={`${sectionLabel} mb-2`}>
                Citazioni KB ({session.citazioni_kb.length})
              </p>
              <div className="space-y-2">
                {session.citazioni_kb.map((c, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-uc-border bg-[rgba(46,111,242,0.06)] px-4 py-2 text-xs italic text-uc-ink"
                  >
                    "{c}"
                  </div>
                ))}
              </div>
            </div>
          )}

          {session.motivo_handoff && (
            <div>
              <p className={`${sectionLabel} mb-2`}>Motivo handoff</p>
              <div className="rounded-lg border border-uc-border bg-[rgba(192,133,50,0.08)] px-4 py-3 text-sm text-uc-amber">
                {session.motivo_handoff}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-uc-border px-6 py-4">
          <a
            href={`https://app.gohighlevel.com/v2/location/${GHL_LOCATION_ID}/contacts/detail/${session.contact_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`${btnPrimary} block w-full text-center`}
          >
            Apri in GHL →
          </a>
        </div>
      </div>
    </div>
  )
}

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
      query = query
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
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

  return (
    <>
      <Card
        label="Sessioni AI"
        title="Tutte le sessioni"
        action={
          <div className="flex flex-wrap gap-2">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className={`${inputBase} w-auto`}
            />
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className={`${inputBase} w-auto`}
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
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-uc-border text-[10px] uppercase tracking-wide text-uc-muted">
                  <th className="pb-2 pr-3 font-medium">Data</th>
                  <th className="pb-2 pr-3 font-medium">Cliente</th>
                  <th className="pb-2 pr-3 font-medium">Servizio</th>
                  <th className="pb-2 font-medium">Esito</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr
                    key={session.id}
                    onClick={() => setSelected(session)}
                    className="cursor-pointer border-b border-uc-border/60 transition-colors last:border-0 hover:bg-uc-canvas"
                  >
                    <td className={`${rowSub} py-2 pr-3`}>
                      {formatDateTime(session.created_at)}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs text-uc-ink">
                      {shortId(session.contact_id)}
                    </td>
                    <td className="py-2 pr-3 text-xs text-uc-ink">
                      {session.servizio || '—'}
                    </td>
                    <td className="py-2">
                      <span className={pillClass(ESITO_VARIANT[session.esito] ?? 'neutral')}>
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
