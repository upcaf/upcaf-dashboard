import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  Card,
  EmptyState,
  ErrorBanner,
  formatDateTime,
  LoadingState,
} from './ui'

export default function ErrorLogsPanel() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!supabase) {
      setError('Supabase non configurato')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('session_logs')
      .select('*')
      .eq('esito', 'errore')
      .order('created_at', { ascending: false })
      .limit(50)

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setLogs(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function errorMessage(log) {
    return (
      log.sintesi ||
      log.motivo_handoff ||
      log.errore ||
      log.error_message ||
      'Errore non specificato'
    )
  }

  return (
    <Card
      title="Log errori pipeline"
      action={
        <button
          type="button"
          onClick={load}
          className="text-sm font-medium text-brand-accent hover:underline"
        >
          Ricarica
        </button>
      }
    >
      <ErrorBanner message={error} />

      {loading ? (
        <LoadingState />
      ) : logs.length === 0 ? (
        <EmptyState message="Nessun errore registrato" />
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <article
              key={log.id}
              className="rounded-lg border border-red-100 bg-red-50/50 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-xs font-medium text-red-600">
                  {formatDateTime(log.created_at)}
                </p>
                {log.servizio && (
                  <span className="rounded-full bg-white px-2.5 py-0.5 text-xs text-slate-600">
                    {log.servizio}
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-red-900">{errorMessage(log)}</p>
              {log.contact_id && (
                <p className="mt-1 text-xs text-red-700/70">
                  Contatto: {log.contact_id}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </Card>
  )
}
