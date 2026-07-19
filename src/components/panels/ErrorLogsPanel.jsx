import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  btnSecondary,
  Card,
  EmptyState,
  ErrorBanner,
  formatDateTime,
  ItemRow,
  LoadingState,
  pillClass,
  rowSub,
  rowText,
} from '../ui'

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
      label="Sistema"
      title="Log errori pipeline"
      action={
        <button type="button" onClick={load} className={btnSecondary}>
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
        <div className="flex flex-col gap-2">
          {logs.map((log) => (
            <ItemRow key={log.id}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className={rowSub}>{formatDateTime(log.created_at)}</p>
                {log.servizio && (
                  <span className={pillClass('neutral')}>{log.servizio}</span>
                )}
              </div>
              <p className={`${rowText} text-uc-red`}>{errorMessage(log)}</p>
              {log.contact_id && (
                <p className={`${rowSub} mt-1`}>Contatto: {log.contact_id}</p>
              )}
            </ItemRow>
          ))}
        </div>
      )}
    </Card>
  )
}
