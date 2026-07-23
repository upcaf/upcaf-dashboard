import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  Card,
  EmptyState,
  ErrorBanner,
  formatDateTime,
  LoadingState,
} from './ui'

const ESITO_BADGE_CLASS = {
  risolto: 'bg-emerald-100 text-emerald-800',
  errore: 'bg-red-100 text-red-800',
  handoff: 'bg-amber-100 text-amber-800',
}
const DEFAULT_BADGE_CLASS = 'bg-slate-100 text-slate-700'

export default function SessionsPanel() {
  const [sessions, setSessions] = useState([])
  const [allServices, setAllServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dateFilter, setDateFilter] = useState('')
  const [serviceFilter, setServiceFilter] = useState('')

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

  return (
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
                <tr key={session.id} className="text-slate-700">
                  <td className="py-3 pr-4 whitespace-nowrap">
                    {formatDateTime(session.created_at)}
                  </td>
                  <td className="py-3 pr-4">
                    {session.contact_id || '—'}
                  </td>
                  <td className="py-3 pr-4">{session.servizio || '—'}</td>
                  <td className="py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        ESITO_BADGE_CLASS[session.esito] ?? DEFAULT_BADGE_CLASS
                      }`}
                    >
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
  )
}
