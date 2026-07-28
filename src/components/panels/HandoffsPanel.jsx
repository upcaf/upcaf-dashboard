// src/components/panels/HandoffsPanel.jsx
// Handoff aperti — casi passati all'operatore umano
// Versione: 2.0 — 28 luglio 2026
//
// v2.0:
// (1) CHIUSURA VIA ENDPOINT — non più .delete() diretto su Supabase.
//     POST /handoffs/close cambia lo stato e conserva la riga. Gli handoff
//     sono i casi in cui l'AI si è fermata: cancellarli butta via la sola
//     evidenza di quando e perché il sistema sceglie di non rispondere.
// (2) FILTRO CANALE — prop `canale`:
//       <HandoffsPanel />                            → tutti
//       <HandoffsPanel canale="ghl" />               → whatsapp_inbound + legacy (NULL)
//       <HandoffsPanel canale="whatsapp_operativo" />→ Canale 3
//     I record precedenti alla v2.30 hanno canale NULL e vanno letti come GHL.
// (3) CONFERMA — chiudere riattiva la pipeline AI sul contatto: il prossimo
//     messaggio riceve di nuovo una bozza automatica. Serve un click voluto.

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  btnPrimary,
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
  urgencyBadgeClass,
} from '../ui'

const CANALE3_URL = 'https://gateway-production-4696.up.railway.app'

function isCanale3(canale) {
  return canale === 'whatsapp_operativo'
}

async function chiudiHandoff(handoff_id) {
  const res = await fetch(`${CANALE3_URL}/handoffs/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ handoff_id }),
  })
  if (!res.ok) {
    let dettaglio = `HTTP ${res.status}`
    try {
      const body = await res.json()
      if (body?.error) dettaglio = body.error
    } catch { /* risposta non JSON */ }
    throw new Error(dettaglio)
  }
  return res.json()
}

export default function HandoffsPanel({ canale = null, title }) {
  const [handoffs, setHandoffs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [confermaId, setConfermaId] = useState(null)
  const [closingId, setClosingId] = useState(null)

  const load = useCallback(async () => {
    if (!supabase) {
      setError('Supabase non configurato')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)

    let query = supabase
      .from('pending_handoffs')
      .select('*')
      .eq('stato', 'aperto')
      .order('created_at', { ascending: false })

    if (canale === 'whatsapp_operativo') {
      query = query.eq('canale', 'whatsapp_operativo')
    } else if (canale === 'ghl') {
      query = query.or('canale.eq.whatsapp_inbound,canale.is.null')
    }

    const { data, error: fetchError } = await query

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setHandoffs(data ?? [])
    }
    setLoading(false)
  }, [canale])

  useEffect(() => {
    load()
  }, [load])

  async function handleClose(id) {
    setClosingId(id)
    setError(null)
    try {
      await chiudiHandoff(id)
      setHandoffs((prev) => prev.filter((h) => h.id !== id))
      setConfermaId(null)
    } catch (err) {
      setError('Chiusura non riuscita: ' + err.message)
    } finally {
      setClosingId(null)
    }
  }

  return (
    <Card
      label={title || 'Handoff aperti'}
      title={handoffs.length > 0 ? `${handoffs.length} in attesa` : undefined}
      action={
        <button type="button" onClick={load} className={btnSecondary}>
          Aggiorna
        </button>
      }
    >
      <ErrorBanner message={error} />

      {loading ? (
        <LoadingState />
      ) : handoffs.length === 0 ? (
        <EmptyState message="Nessun handoff in attesa" />
      ) : (
        <div className="flex flex-col gap-2">
          {handoffs.map((item) => {
            const inConferma = confermaId === item.id
            const inCorso = closingId === item.id

            return (
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
                      {/* Il canale si mostra solo nella vista aggregata:
                          nei tab dedicati sarebbe rumore ripetuto su ogni riga. */}
                      {!canale && (
                        <span className={pillClass(isCanale3(item.canale) ? 'green' : 'blue')}>
                          {isCanale3(item.canale) ? 'Canale 3' : 'GHL'}
                        </span>
                      )}
                    </div>

                    {item.contact_phone && (
                      <p className={rowSub}>Telefono: {item.contact_phone}</p>
                    )}
                    {item.sintesi && <p className={rowSub}>Sintesi: {item.sintesi}</p>}
                    <p className={rowSub}>Servizio: {item.servizio || '—'}</p>
                    <p className={rowSub}>Motivo: {item.motivo_handoff || '—'}</p>
                    <p className={`${rowSub} mt-1`}>{formatDateTime(item.created_at)}</p>
                  </div>

                  <div className="shrink-0">
                    {inConferma ? (
                      <div className="flex flex-col items-end gap-1.5">
                        <button
                          type="button"
                          disabled={inCorso}
                          onClick={() => handleClose(item.id)}
                          className={btnPrimary}
                        >
                          {inCorso ? 'Chiusura…' : 'Conferma chiusura'}
                        </button>
                        <button
                          type="button"
                          disabled={inCorso}
                          onClick={() => setConfermaId(null)}
                          className="text-[10px] text-uc-muted hover:underline"
                        >
                          annulla
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfermaId(item.id)}
                        className={btnSecondary}
                      >
                        Segna risolto
                      </button>
                    )}
                  </div>
                </div>

                {inConferma && (
                  <p className="mt-2 rounded-lg bg-[rgba(192,133,50,0.08)] px-3 py-2 text-[10px] text-uc-amber">
                    Chiudendo, la pipeline AI riprende su questo contatto: il
                    prossimo messaggio riceverà di nuovo una bozza automatica.
                  </p>
                )}
              </ItemRow>
            )
          })}
        </div>
      )}
    </Card>
  )
}
