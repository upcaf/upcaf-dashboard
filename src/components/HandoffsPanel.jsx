import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  Card,
  EmptyState,
  ErrorBanner,
  formatDateTime,
  LoadingState,
  urgencyBadgeClass,
} from './ui'

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
    <Card title="Handoff aperti">
      <ErrorBanner message={error} />

      {loading ? (
        <LoadingState />
      ) : handoffs.length === 0 ? (
        <EmptyState message="Nessun handoff in attesa" />
      ) : (
        <div className="space-y-3">
          {handoffs.map((item) => (
            <article
              key={item.id}
              className="rounded-lg border border-slate-100 bg-slate-50/80 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-brand-primary">
                      {item.cliente || item.contact_name || 'Cliente sconosciuto'}
                    </h3>
                    {item.urgenza && (
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${urgencyBadgeClass(item.urgenza)}`}
                      >
                        {item.urgenza}
                      </span>
                    )}
                  </div>
                  {item.contact_phone && (
                    <p className="text-sm text-slate-600">
                      <span className="font-medium">Telefono:</span>{' '}
                      {item.contact_phone}
                    </p>
                  )}
                  {item.sintesi && (
                    <p className="text-sm text-slate-600">
                      <span className="font-medium">Sintesi:</span>{' '}
                      {item.sintesi}
                    </p>
                  )}
                  <p className="text-sm text-slate-600">
                    <span className="font-medium">Servizio:</span>{' '}
                    {item.servizio || '—'}
                  </p>
                  <p className="text-sm text-slate-600">
                    <span className="font-medium">Motivo:</span>{' '}
                    {item.motivo_handoff || '—'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatDateTime(item.created_at)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={resolvingId === item.id}
                  onClick={() => markResolved(item.id)}
                  className="shrink-0 rounded-lg bg-brand-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
                >
                  {resolvingId === item.id ? 'Salvataggio…' : 'Segna come risolto'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </Card>
  )
}
