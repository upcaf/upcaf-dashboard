// src/components/panels/HandoffsPanel.jsx
// Handoff aperti — casi passati all'operatore umano
// Versione: 2.1 — mobile-friendly
//
// v2.1: ottimizzazione mobile.
//   - Card verticale invece di layout flex orizzontale fisso
//   - Bottone "Segna risolto" a tutta larghezza su mobile
//   - Conferma con avviso sotto la card invece che inline
//   - Pill canale e urgenza su riga separata, sempre visibili
//   - Nessuna regressione sul comportamento v2.0:
//     chiusura via endpoint, filtro canale, conferma in due tempi
//
// Regola Vite 8: zero template literal nel JSX — solo concatenazioni.

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
  const res = await fetch(CANALE3_URL + '/handoffs/close', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ handoff_id }),
  })
  if (!res.ok) {
    let dettaglio = 'HTTP ' + res.status
    try {
      const body = await res.json()
      if (body?.error) dettaglio = body.error
    } catch { /* risposta non JSON */ }
    throw new Error(dettaglio)
  }
  return res.json()
}

export default function HandoffsPanel({ canale = null, title }) {
  const [handoffs, setHandoffs]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
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

  useEffect(() => { load() }, [load])

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
      title={handoffs.length > 0 ? handoffs.length + ' in attesa' : undefined}
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
            const inCorso    = closingId === item.id

            return (
              <ItemRow key={item.id}>
                {/* ── Info principale ── */}
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <h3 className={rowText + ' font-medium'}>
                    {item.cliente || item.contact_name || 'Cliente sconosciuto'}
                  </h3>
                  {item.urgenza && (
                    <span className={urgencyBadgeClass(item.urgenza)}>{item.urgenza}</span>
                  )}
                  {!canale && (
                    <span className={pillClass(isCanale3(item.canale) ? 'green' : 'blue')}>
                      {isCanale3(item.canale) ? 'Canale 3' : 'GHL'}
                    </span>
                  )}
                </div>

                {/* ── Dettagli ── */}
                <div className="mb-3 space-y-0.5">
                  {item.contact_phone && (
                    <p className={rowSub}>{'Tel: ' + item.contact_phone}</p>
                  )}
                  <p className={rowSub}>{'Servizio: ' + (item.servizio || '—')}</p>
                  <p className={rowSub}>{'Motivo: ' + (item.motivo_handoff || '—')}</p>
                  {item.sintesi && (
                    <p className={rowSub}>{'Sintesi: ' + item.sintesi}</p>
                  )}
                  <p className={rowSub + ' mt-1'}>{formatDateTime(item.created_at)}</p>
                </div>

                {/* ── Avviso conferma ── */}
                {inConferma && (
                  <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-uc-amber border border-amber-200">
                    Chiudendo, la pipeline AI riprende su questo contatto: il prossimo messaggio riceverà di nuovo una bozza automatica.
                  </div>
                )}

                {/* ── Bottoni — sempre a tutta larghezza su mobile ── */}
                {inConferma ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      disabled={inCorso}
                      onClick={() => setConfermaId(null)}
                      className={btnSecondary}
                    >
                      Annulla
                    </button>
                    <button
                      type="button"
                      disabled={inCorso}
                      onClick={() => handleClose(item.id)}
                      className={btnPrimary}
                    >
                      {inCorso ? 'Chiusura...' : 'Conferma chiusura'}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfermaId(item.id)}
                    className={btnSecondary + ' w-full sm:w-auto sm:self-end'}
                  >
                    Segna risolto
                  </button>
                )}
              </ItemRow>
            )
          })}
        </div>
      )}
    </Card>
  )
}
