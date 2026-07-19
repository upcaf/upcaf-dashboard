import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  btnPrimary,
  Card,
  EmptyState,
  ErrorBanner,
  formatDateTime,
  ItemRow,
  LoadingState,
  pillClass,
  rowSub,
  rowText,
  urgencyBadgeClass,
} from '../ui'

export default function HandoffsPanel() {
  const [handoffs, setHandoffs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [resolvingId, setResolvingId] = useState(null)

  const load = useCallback(async () => {
    if (!supabase) {
      setError('Supabase non configurato')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('pending_handoffs')
      .select('*')
      .eq('stato', 'aperto')
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setHandoffs(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function markResolved(id) {
    if (!supabase) return
    setResolvingId(id)
    setError(null)

    const { error: deleteError } = await supabase
      .from('pending_handoffs')
      .delete()
      .eq('id', id)

    if (deleteError) {
      setError(deleteError.message)
    } else {
      setHandoffs((prev) => prev.filter((h) => h.id !== id))
    }
    setResolvingId(null)
  }

  return (
    <Card label="Handoff aperti">
      <ErrorBanner message={error} />

      {loading ? (
        <LoadingState />
      ) : handoffs.length === 0 ? (
        <EmptyState message="Nessun handoff in attesa" />
      ) : (
        <div className="flex flex-col gap-2">
          {handoffs.map((item) => (
            <ItemRow key={item.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <h3 className={`${rowText} font-medium`}>
                      {item.cliente || item.contact_name || 'Cliente sconosciuto'}
                    </h3>
                    {item.urgenza && (
                      <span className={urgencyBadgeClass(item.urgenza)}>
                        {item.urgenza}
                      </span>
                    )}
                  </div>
                  {item.contact_phone && (
                    <p className={rowSub}>Telefono: {item.contact_phone}</p>
                  )}
                  {item.sintesi && (
                    <p className={rowSub}>Sintesi: {item.sintesi}</p>
                  )}
                  <p className={rowSub}>Servizio: {item.servizio || '—'}</p>
                  <p className={rowSub}>
                    Motivo: {item.motivo_handoff || '—'}
                  </p>
                  <p className={`${rowSub} mt-1`}>
                    {formatDateTime(item.created_at)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={resolvingId === item.id}
                  onClick={() => markResolved(item.id)}
                  className={`${btnPrimary} shrink-0`}
                >
                  {resolvingId === item.id ? 'Salvataggio…' : 'Segna risolto'}
                </button>
              </div>
            </ItemRow>
          ))}
        </div>
      )}
    </Card>
  )
}
