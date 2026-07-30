// src/components/panels/WhatsAppPanel.jsx
// Pannello bozze in attesa di approvazione — Canale 3 e Canale 2 GHL
// Versione: 1.4 — 30 luglio 2026
//
// v1.4 — Gestione contatti LID:
//   Quando il gateway risponde 422 con { lid: true }, l'errore rosso generico
//   viene sostituito da un avviso giallo specifico che spiega la situazione
//   e fornisce un link diretto alla conversazione GHL per l'invio manuale.
//   Il link GHL è costruito con l'URL base di GHL + contactId.
//   Stessa gestione applicata sia in WhatsAppCard (bozze Canale 2)
//   che in ApprovalsPanel (DA_APPROVARE) tramite lo stesso pattern
//   { lid: true } restituito da /approvals/send.
//
// v1.3 — Canale 2 GHL human-in-the-loop:
//   Prop "canale" che parametrizza tutto il comportamento:
//     canale="operativo" (default) → Canale 3, comportamento identico alla v1.2
//     canale="ghl"                 → Canale 2 GHL, endpoint /ghl/send e /ghl/reject,
//                                    /wa/pending?canale=whatsapp_inbound,
//                                    label badge "GHL / META WA"
//
// v1.2: ottimizzazione mobile (bottoni full-width, textarea 5 righe,
//       griglia motivi 2 colonne, header verticale su small).
//
// Regola Vite 8: zero template literal nel JSX — solo concatenazioni.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, EmptyState, ErrorBanner, LoadingState, formatDateTime } from '../ui'

const GATEWAY_URL = 'https://gateway-production-4696.up.railway.app'

// URL base GHL per link conversazione — apre direttamente la chat del contatto
const GHL_CONVERSATION_URL = 'https://app.gohighlevel.com/v2/location/otZi0Yae4nEnmUzTXzOD/conversations/'

const MOTIVO_OBBLIGATORIO = true

const MOTIVI = [
  { key: 'dato_sbagliato',       label: 'Dato sbagliato',       hint: 'Il numero era errato' },
  { key: 'dato_superato',        label: 'Dato superato',        hint: 'La KB era vecchia' },
  { key: 'mancava_info',         label: 'Mancava info',         hint: 'Risposta incompleta' },
  { key: 'promessa_impossibile', label: 'Promessa impossibile', hint: 'Il sistema non può onorarla' },
  { key: 'troppo_lungo',         label: 'Troppo lungo',         hint: 'Stile WhatsApp' },
  { key: 'tono',                 label: 'Tono',                 hint: 'Forma, non contenuto' },
]

// ── Funzioni API parametriche ─────────────────────────────────────────────

function buildFetchUrl(canale) {
  if (canale === 'ghl') {
    return GATEWAY_URL + '/wa/pending?canale=whatsapp_inbound'
  }
  return GATEWAY_URL + '/wa/pending?canale=whatsapp_operativo'
}

async function fetchPending(canale) {
  const res = await fetch(buildFetchUrl(canale))
  if (!res.ok) throw new Error('HTTP ' + res.status)
  const data = await res.json()
  return data.pending || []
}

/**
 * Invia la bozza approvata.
 *
 * Canale 3: POST /openwa/send con { pending_id, numero, testo_finale, motivo_correzione }
 * Canale 2 GHL: POST /ghl/send con { pending_id, contact_id, testo_finale, motivo_correzione }
 *
 * v1.4: se la risposta è 422 con { lid: true }, lancia un errore speciale
 * con la proprietà .lid = true così WhatsAppCard può mostrare l'avviso LID
 * invece del messaggio di errore generico rosso.
 */
async function sendMessage({ canale, pending_id, item, testo_finale, motivo_correzione }) {
  let endpoint, body

  if (canale === 'ghl') {
    endpoint = GATEWAY_URL + '/ghl/send'
    body = {
      pending_id,
      contact_id:        item.contact_id,
      testo_finale,
      motivo_correzione: motivo_correzione || null,
    }
  } else {
    endpoint = GATEWAY_URL + '/openwa/send'
    body = {
      pending_id,
      numero:            item.numero,
      testo_finale,
      motivo_correzione: motivo_correzione || null,
    }
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  // ── Gestione LID (v1.4) ───────────────────────────────────────────────
  // Il gateway risponde 422 con { lid: true } quando il contact_id è un
  // identificatore interno Meta (@lid) non supportato dalla GHL API.
  if (res.status === 422) {
    let respBody = {}
    try { respBody = await res.json() } catch { /* non JSON */ }
    if (respBody?.lid) {
      const err = new Error(respBody.error || 'Contatto LID')
      err.lid = true
      err.contactId = item.contact_id || null
      throw err
    }
  }

  if (!res.ok) {
    let dettaglio = 'HTTP ' + res.status
    try {
      const respBody = await res.json()
      if (respBody?.error) dettaglio = respBody.error
    } catch { /* risposta non JSON */ }
    throw new Error(dettaglio)
  }
  return res.json()
}

async function rejectMessage({ canale, pending_id }) {
  const endpoint = canale === 'ghl'
    ? GATEWAY_URL + '/ghl/reject'
    : GATEWAY_URL + '/wa/reject'

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pending_id }),
  })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return res.json()
}

// ── Avviso LID ────────────────────────────────────────────────────────────
// Mostrato al posto dell'errore rosso quando il contatto è un @lid.
// Fornisce un link diretto alla conversazione GHL per l'invio manuale.
function LidWarning({ contactId }) {
  const ghlUrl = contactId
    ? GHL_CONVERSATION_URL + contactId
    : null

  return (
    <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
      <div className="font-semibold mb-1">⚠️ Contatto LID — invio manuale richiesto</div>
      <p className="text-xs text-amber-800 mb-2">
        Questo contatto usa un identificatore interno Meta che GHL non accetta via API.
        Copia il testo qui sopra e invialo direttamente dalla conversazione GHL.
      </p>
      {ghlUrl && (
        <a
          href={ghlUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-lg bg-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-300 transition"
        >
          Apri conversazione in GHL →
        </a>
      )}
    </div>
  )
}

// ── Singola card bozza ────────────────────────────────────────────────────

function WhatsAppCard({ item, canale, onSent, onRejected }) {
  const bozzaOriginale = item.risposta_ai || ''
  const senzaBozza     = !bozzaOriginale.trim()

  const [testo, setTesto]     = useState(bozzaOriginale)
  const [motivo, setMotivo]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [isLid, setIsLid]     = useState(false)
  const [lidContactId, setLidContactId] = useState(null)

  const minutiAttesa = Math.floor(
    (Date.now() - new Date(item.created_at).getTime()) / 60000
  )
  const urgente = minutiAttesa >= 10

  const modificato = useMemo(
    () => !senzaBozza && testo.trim() !== bozzaOriginale.trim(),
    [testo, bozzaOriginale, senzaBozza]
  )

  const serveMotivo       = MOTIVO_OBBLIGATORIO && modificato
  const bloccatoDalMotivo = serveMotivo && !motivo

  async function handleSend() {
    if (!testo.trim() || bloccatoDalMotivo) return
    setLoading(true)
    setError(null)
    setIsLid(false)
    setLidContactId(null)
    try {
      await sendMessage({
        canale,
        pending_id:        item.id,
        item,
        testo_finale:      testo.trim(),
        motivo_correzione: modificato ? motivo : null,
      })
      onSent(item.id)
    } catch (err) {
      if (err.lid) {
        // Contatto LID — mostra avviso giallo, non errore rosso
        setIsLid(true)
        setLidContactId(err.contactId || item.contact_id || null)
      } else {
        setError('Errore invio: ' + err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleReject() {
    setLoading(true)
    setError(null)
    setIsLid(false)
    try {
      await rejectMessage({ canale, pending_id: item.id })
      onRejected(item.id)
    } catch (err) {
      setError('Errore rifiuto: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const cardClass = urgente
    ? 'rounded-xl border border-amber-300 bg-amber-50 p-4'
    : 'rounded-xl border border-slate-200 bg-white p-4'

  const badgeLabel = canale === 'ghl' ? 'GHL / META WA' : 'WA OPERATIVO'
  const badgeClass = canale === 'ghl'
    ? 'rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800'
    : 'rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800'

  const inviaLabel = canale === 'ghl' ? '✓ Invia via GHL' : '✓ Invia su WhatsApp'

  return (
    <div className={cardClass}>

      {/* ── Header ── */}
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {urgente && (
            <span className="rounded-full bg-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-900">
              {'⏱ ' + minutiAttesa + ' min'}
            </span>
          )}
          <span className="text-sm font-semibold text-slate-800">
            {item.nome_cliente || 'nome non noto'}
          </span>
          <span className="text-xs text-slate-400">
            {canale === 'ghl' ? (item.contact_id || '—') : (item.numero || '—')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={badgeClass}>{badgeLabel}</span>
          <span className="text-xs text-slate-400">{formatDateTime(item.created_at)}</span>
        </div>
      </div>

      {/* ── Messaggio cliente ── */}
      <div className="mb-3 rounded-lg border-l-4 border-slate-400 bg-slate-50 px-3 py-2">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Il cliente ha scritto
        </div>
        <p className="whitespace-pre-wrap text-sm text-slate-800">
          {item.messaggio_ricevuto || '—'}
        </p>
      </div>

      {/* ── Sintesi agente ── */}
      {item.sintesi_agente && (
        <div className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
          <span className="font-medium">Sintesi AI: </span>{item.sintesi_agente}
        </div>
      )}

      {/* ── Avviso nessuna bozza ── */}
      {senzaBozza && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Nessuna bozza AI — pipeline saltata (handoff aperto). Scrivi tu la risposta.
        </div>
      )}

      {/* ── Bozza / area di testo ── */}
      <div className="mb-1 flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {senzaBozza ? 'Risposta' : 'Bozza di risposta'}
        </span>
        {modificato && (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-800">
            modificata
          </span>
        )}
      </div>
      <textarea
        value={testo}
        onChange={(e) => setTesto(e.target.value)}
        rows={5}
        disabled={loading}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-green-300 disabled:opacity-60"
        placeholder="Scrivi o modifica la risposta..."
      />

      {/* ── Selettore motivo — 2 colonne su mobile ── */}
      {modificato && (
        <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
          <div className="mb-2 text-xs text-blue-900">
            Hai corretto la bozza.{' '}
            <span className="font-semibold">Perché?</span>
            {MOTIVO_OBBLIGATORIO && (
              <span className="text-blue-700"> (obbligatorio)</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
            {MOTIVI.map(({ key, label, hint }) => {
              const attivo = motivo === key
              return (
                <button
                  key={key}
                  type="button"
                  title={hint}
                  disabled={loading}
                  onClick={() => setMotivo(attivo ? null : key)}
                  className={
                    'rounded-lg border px-2.5 py-2 text-xs font-medium transition disabled:opacity-50 ' +
                    (attivo
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-blue-200 bg-white text-blue-800 hover:bg-blue-100')
                  }
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Errore generico ── */}
      {error && !isLid && (
        <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
      )}

      {/* ── Avviso LID (v1.4) ── */}
      {isLid && <LidWarning contactId={lidContactId} />}

      {/* ── Bottoni azione — impilati su mobile, affiancati su sm+ ── */}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          onClick={handleSend}
          disabled={loading || !testo.trim() || bloccatoDalMotivo}
          title={bloccatoDalMotivo ? 'Scegli prima il motivo della correzione' : undefined}
          className="flex-1 rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {loading
            ? 'Invio in corso...'
            : bloccatoDalMotivo
              ? 'Scegli il motivo per inviare'
              : inviaLabel}
        </button>
        <button
          onClick={handleReject}
          disabled={loading}
          className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition sm:w-auto"
        >
          Rifiuta
        </button>
      </div>
    </div>
  )
}

// ── Pannello principale ───────────────────────────────────────────────────

/**
 * WhatsAppPanel — pannello bozze in attesa di approvazione.
 *
 * Props:
 *   canale: "operativo" (default) | "ghl"
 *     "operativo" → Canale 3, whatsapp-web.js, badge verde "WA OPERATIVO"
 *     "ghl"       → Canale 2 GHL, GHL API, badge blu "GHL / META WA"
 */
export default function WhatsAppPanel({ canale = 'operativo' }) {
  const [items, setItems]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [waStatus, setWaStatus] = useState(null)
  const [showQR, setShowQR]     = useState(false)

  const isCanale3 = canale !== 'ghl'

  const load = useCallback(async () => {
    try {
      const data = await fetchPending(canale)
      setItems(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [canale])

  const checkStatus = useCallback(async () => {
    if (!isCanale3) {
      setWaStatus(null)
      return
    }
    try {
      const res  = await fetch(GATEWAY_URL + '/health')
      const data = await res.json()
      setWaStatus(data.wa_canale3 || 'sconosciuto')
    } catch {
      setWaStatus('non raggiungibile')
    }
  }, [isCanale3])

  useEffect(() => {
    load()
    checkStatus()
    const i1 = setInterval(load, 10000)
    const i2 = setInterval(checkStatus, 30000)
    return () => { clearInterval(i1); clearInterval(i2) }
  }, [load, checkStatus])

  function handleSent(id)     { setItems((prev) => prev.filter((i) => i.id !== id)) }
  function handleRejected(id) { setItems((prev) => prev.filter((i) => i.id !== id)) }

  const connesso    = waStatus === 'pronto'
  const titoloPannello = canale === 'ghl'
    ? 'GHL / Meta WhatsApp' + (items.length > 0 ? ' (' + items.length + ')' : '')
    : 'WhatsApp Operativo'  + (items.length > 0 ? ' (' + items.length + ')' : '')

  return (
    <Card
      title={titoloPannello}
      action={
        <div className="flex items-center gap-2">

          {/* Status connessione — solo Canale 3 */}
          {isCanale3 && waStatus && (
            <span className={
              'rounded-full px-2 py-0.5 text-xs font-medium ' +
              (connesso ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')
            }>
              {connesso ? '● connesso' : '● disconnesso'}
            </span>
          )}

          {/* Badge GHL — solo Canale 2 */}
          {!isCanale3 && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
              ● GHL attivo
            </span>
          )}

          {/* QR — solo Canale 3 */}
          {isCanale3 && (
            <button
              onClick={() => setShowQR(!showQR)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              QR
            </button>
          )}

          <button
            onClick={load}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            ↺
          </button>
        </div>
      }
    >
      <ErrorBanner message={error} />

      {/* QR scanner — solo Canale 3 */}
      {isCanale3 && showQR && (
        <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col items-center gap-2">
          <p className="text-xs text-slate-500 text-center">
            WhatsApp → Impostazioni → Dispositivi collegati → Collega un dispositivo
          </p>
          <img
            src={GATEWAY_URL + '/wa/qr?t=' + Date.now()}
            alt="QR WhatsApp"
            className="rounded-lg border border-slate-200"
            style={{ width: 220, height: 220 }}
            onError={(e) => { e.target.style.display = 'none' }}
          />
          <p className="text-xs text-slate-400 text-center">
            Se il QR non appare, WhatsApp è già connesso.
          </p>
        </div>
      )}

      {/* Avviso disconnessione — solo Canale 3 */}
      {isCanale3 && waStatus && !connesso && !showQR && (
        <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          ⚠️ WhatsApp non connesso — clicca <strong>QR</strong> per scansionare.
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState message="Nessun messaggio in attesa" />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-slate-500">
            Nessun messaggio parte senza la tua approvazione.
          </p>
          {items.map((item) => (
            <WhatsAppCard
              key={item.id}
              item={item}
              canale={canale}
              onSent={handleSent}
              onRejected={handleRejected}
            />
          ))}
        </div>
      )}
    </Card>
  )
}
