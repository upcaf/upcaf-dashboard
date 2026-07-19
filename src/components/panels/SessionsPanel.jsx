import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Card,
  EmptyState,
  ErrorBanner,
  formatDateTime,
  inputBase,
  LoadingState,
  pillClass,
  rowSub,
} from '../ui'

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
      .eq('esito', 'risolto')
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
      .eq('esito', 'risolto')
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
    <Card
      label="Sessioni AI"
      title="Risolte autonomamente"
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
        <EmptyState message="Nessuna sessione risolta trovata" />
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
                  className="border-b border-uc-border/60 last:border-0"
                >
                  <td className={`${rowSub} py-2 pr-3`}>
                    {formatDateTime(session.created_at)}
                  </td>
                  <td className="py-2 pr-3 text-xs text-uc-ink">
                    {session.contact_id || '—'}
                  </td>
                  <td className="py-2 pr-3 text-xs text-uc-ink">
                    {session.servizio || '—'}
                  </td>
                  <td className="py-2">
                    <span className={pillClass('green')}>{session.esito}</span>
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
