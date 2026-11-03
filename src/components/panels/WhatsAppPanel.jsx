// src/components/panels/WhatsAppPanel.jsx
// Pannello bozze in attesa di approvazione — Canale 3 e Canale 2 GHL
// Versione: 2.0 — 31 ottobre 2026
//
// v2.0 — Nuova grafica stile WhatsApp Web: lista chat a sinistra, conversazione
//   con bozza tratteggiata a destra (su telefono: lista, poi conversazione).
//   Stessi endpoint di v1.4. Tolta la scelta del motivo di correzione: il gateway
//   salva già bozza AI e testo inviato (stato modificato_e_inviato), il motivo si ricava dopo.
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
import { getToken } from '../../lib/gatewayAuth'

const GATEWAY_URL = 'https://gateway-production-4696.up.railway.app'

// URL base GHL per link conversazione — apre direttamente la chat del contatto
const GHL_CONVERSATION_URL = 'https://app.gohighlevel.com/v2/location/otZi0Yae4nEnmUzTXzOD/conversations/'

// ── Funzioni API parametriche ─────────────────────────────────────────────

// Le bozze senza canale (vecchie) sono del canale GHL, come nei contatori.
function canaleDi(item) {
  return (!item.canale || item.canale === 'whatsapp_inbound') ? 'ghl' : 'operativo'
}

const VECCHIE_GIORNI = 7
function eVecchia(item) {
  return Date.now() - new Date(item.created_at).getTime() > VECCHIE_GIORNI * 86400000
}

async function fetchStorico(item) {
  const id = item.contact_id || item.numero
  const res = await fetch(GATEWAY_URL + '/wa/history?contact_id=' + encodeURIComponent(id))
  if (!res.ok) throw new Error('HTTP ' + res.status)
  const data = await res.json()
  return data.storia || []
}

function buildFetchUrl(canale) {
  if (canale === 'ghl') {
    return GATEWAY_URL + '/wa/pending?canale=whatsapp_inbound'
  }
  if (canale === 'operativo') {
    return GATEWAY_URL + '/wa/pending?canale=whatsapp_operativo'
  }
  return GATEWAY_URL + '/wa/pending'
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

// ── Modalità dimostrativa (?demo=1) ───────────────────────────────────────
// Mostra tre chat finte per vedere la grafica anche senza messaggi in attesa.
// Non chiama mai il gateway: invio e scarto agiscono solo sullo schermo.
const DEMO_ATTIVA =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('demo') === '1'

const ADESSO = Date.now()
const DEMO_ITEMS = [
  {
    id: 'demo-1', demo: true, canale: 'whatsapp_operativo', numero: '+39 000 0000001', contact_id: 'demo-1',
    nome_cliente: 'Marco Bianchi',
    messaggio_ricevuto: 'Buongiorno, per il 730 cosa devo portare?',
    risposta_ai: 'Buongiorno, per il 730 servono CU, documento d’identità e le spese detraibili. Ti aspetto giovedì alle 15:30.',
    sintesi_agente: 'Richiesta documenti 730',
    created_at: new Date(ADESSO - 4 * 60000).toISOString(),
  },
  {
    id: 'demo-2', demo: true, canale: 'whatsapp_inbound', numero: '+39 000 0000002', contact_id: 'demo-2',
    nome_cliente: 'Giulia Fontana',
    messaggio_ricevuto: 'Ciao, ho una domanda sul bonus nido, posso passare domani?',
    risposta_ai: 'Ciao, ricevo su appuntamento, trovi i posti liberi qui: https://appt.link/appuntamento-u-p-caf',
    sintesi_agente: null,
    created_at: new Date(ADESSO - 15 * 60000).toISOString(),
  },
  {
    id: 'demo-3', demo: true, canale: 'whatsapp_operativo', numero: '+39 000 0000003', contact_id: 'demo-3',
    nome_cliente: 'Elena Tessari',
    messaggio_ricevuto: 'È arrivata la mia pensione? Mi avevano detto che dovevi controllare.',
    risposta_ai: '',
    sintesi_agente: 'Stato pratica: passa a Ulisse',
    created_at: new Date(ADESSO - 32 * 60000).toISOString(),
  },
]

// ── Utilità grafiche ──────────────────────────────────────────────────────

function iniziali(nome, fallback) {
  const base = (nome || '').trim()
  if (!base) return (fallback || '?').toString().slice(-2)
  const parti = base.split(/\s+/).filter(Boolean)
  const a = parti[0] ? parti[0][0] : ''
  const b = parti.length > 1 ? parti[parti.length - 1][0] : ''
  return (a + b).toUpperCase()
}

function contaParole(testo) {
  return (testo || '').trim().split(/\s+/).filter(Boolean).length
}

function minutiDa(createdAt) {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
}

function etichettaAttesa(createdAt) {
  const min = minutiDa(createdAt)
  if (min < 1) return 'ora'
  if (min < 60) return min + ' min'
  if (min < 1440) return Math.floor(min / 60) + ' h'
  return formatDateTime(createdAt)
}

// ── Riga della lista chat (colonna sinistra) ──────────────────────────────

function ChatRow({ item, attiva, onPick }) {
  const canale = canaleDi(item)
  const senzaBozza = !(item.risposta_ai || '').trim()
  const urgente = minutiDa(item.created_at) >= 10
  const identificativo = canale === 'ghl' ? item.contact_id : item.numero
  const nome = item.nome_cliente || identificativo || 'nome non noto'

  const rowClass =
    'flex w-full items-start gap-3 border-b border-slate-100 px-3 py-3 text-left transition ' +
    (attiva ? 'bg-green-50' : 'bg-white hover:bg-slate-50')

  const chipCanale = canale === 'ghl'
    ? 'rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800'
    : 'rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700'

  return (
    <button type="button" onClick={onPick} className={rowClass}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-900">
        {iniziali(item.nome_cliente, identificativo)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-slate-800">{nome}</span>
          <span className={'shrink-0 text-xs ' + (urgente ? 'font-semibold text-amber-700' : 'text-slate-400')}>
            {etichettaAttesa(item.created_at)}
          </span>
        </span>
        <span className="truncate text-xs text-slate-500">{item.messaggio_ricevuto || '—'}</span>
        <span className="mt-0.5 flex items-center gap-1.5">
          {senzaBozza ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
              Da scrivere
            </span>
          ) : (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-800">
              Bozza pronta
            </span>
          )}
          <span className={chipCanale}>{canale === 'ghl' ? 'GHL' : 'OpenWA'}</span>
        </span>
      </span>
    </button>
  )
}

// ── Conversazione con bozza (colonna destra) ──────────────────────────────

function ChatDetail({ item, testo, onTesto, onSent, onRejected, onBack }) {
  const canale = canaleDi(item)
  const bozzaOriginale = item.risposta_ai || ''
  const senzaBozza     = !bozzaOriginale.trim()

  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [isLid, setIsLid]     = useState(false)
  const [lidContactId, setLidContactId] = useState(null)
  const [storico, setStorico] = useState([])

  useEffect(() => {
    if (item.demo) return undefined
    let vivo = true
    fetchStorico(item)
      .then((s) => { if (vivo) setStorico(s.filter((r) => r.id !== item.id)) })
      .catch(() => { /* lo storico è un extra: se manca, resta il messaggio attuale */ })
    return () => { vivo = false }
  }, [item])

  const modificato = useMemo(
    () => !senzaBozza && testo.trim() !== bozzaOriginale.trim(),
    [testo, bozzaOriginale, senzaBozza]
  )

  const parole            = contaParole(testo)
  const identificativo    = canale === 'ghl' ? item.contact_id : item.numero
  const nome              = item.nome_cliente || identificativo || 'nome non noto'

  async function handleSend() {
    if (!testo.trim()) return
    if (item.demo) { onSent(item.id); return }
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
        motivo_correzione: null,
      })
      onSent(item.id)
    } catch (err) {
      if (err.lid) {
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
    if (item.demo) { onRejected(item.id); return }
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

  const badgeLabel = canale === 'ghl' ? 'GHL' : 'OpenWA'
  const badgeClass = canale === 'ghl'
    ? 'rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800'
    : 'rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800'
  const inviaLabel = canale === 'ghl' ? 'Invia via GHL' : 'Invia su WhatsApp'

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-100">

      {/* ── Intestazione conversazione ── */}
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-3 py-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Torna alle chat"
          className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-slate-700 hover:bg-slate-100 md:hidden"
        >
          ‹
        </button>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-900">
          {iniziali(item.nome_cliente, identificativo)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-bold text-slate-800">{nome}</span>
          <span className="truncate text-xs text-slate-500">{identificativo || '—'}</span>
        </div>
        <span className={badgeClass}>{badgeLabel}</span>
      </div>

      {/* ── Messaggi ── */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4">
        {storico.map((r) => (
          <div key={r.id} className="flex flex-col gap-1.5">
            {r.messaggio_ricevuto && (
              <div className="max-w-[85%] self-start rounded-2xl rounded-tl-sm bg-white px-3 py-2 opacity-80 shadow-sm">
                <p className="whitespace-pre-wrap text-sm text-slate-700">{r.messaggio_ricevuto}</p>
              </div>
            )}
            {r.testo_inviato && (
              <div className="max-w-[85%] self-end rounded-2xl rounded-tr-sm bg-green-100 px-3 py-2 opacity-90 shadow-sm">
                <p className="whitespace-pre-wrap text-sm text-slate-800">{r.testo_inviato}</p>
              </div>
            )}
          </div>
        ))}
        <span className="self-center rounded-full bg-white px-3 py-1 text-xs text-slate-500">
          {formatDateTime(item.created_at)}
        </span>
        <div className="max-w-[85%] self-start rounded-2xl rounded-tl-sm bg-white px-3 py-2 shadow-sm">
          <p className="whitespace-pre-wrap text-sm text-slate-800">{item.messaggio_ricevuto || '—'}</p>
        </div>
        {item.sintesi_agente && (
          <div className="self-start rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
            <span className="font-medium">Sintesi AI: </span>{item.sintesi_agente}
          </div>
        )}
      </div>

      {/* ── Bozza (tratteggiata, non ancora inviata) ── */}
      <div className="m-3 flex flex-col gap-2.5 rounded-2xl border-2 border-dashed border-green-600 bg-white p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">
            {senzaBozza ? 'Scrivi tu la risposta' : 'Bozza AI · non inviata'}
          </span>
          <span className="flex items-center gap-2 text-xs text-slate-500">
            {modificato && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-800">
                modificata
              </span>
            )}
            <span>{parole + ' parole · consigliato 5–25'}</span>
          </span>
        </div>

        {senzaBozza && (
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Nessuna bozza AI (nessuna risposta necessaria, oppure passa a te). Scrivi tu la risposta o scarta.
          </div>
        )}

        <textarea
          value={testo}
          onChange={(e) => onTesto(e.target.value)}
          rows={4}
          disabled={loading}
          aria-label="Testo della risposta"
          className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-300 disabled:opacity-60"
          placeholder="Scrivi o modifica la risposta..."
        />

        {modificato && (
          <p className="text-xs text-slate-500">
            Hai corretto la bozza: salvo la tua versione e il motivo lo ricavo io.
          </p>
        )}

        {error && !isLid && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
        )}
        {isLid && <LidWarning contactId={lidContactId} />}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={handleReject}
            disabled={loading}
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Scarta
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={loading || !testo.trim()}
            className="flex-1 rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Invio in corso...' : inviaLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Pannello principale ───────────────────────────────────────────────────

/**
 * WhatsAppPanel — inbox bozze in attesa di approvazione (grafica stile WhatsApp Web).
 *
 * Props:
 *   canale: "tutti" (default) | "operativo" | "ghl"
 *     "tutti"     → un'unica lista con le chat di OpenWA e di GHL, con filtro
 *     "operativo" → solo Canale 3 (OpenWA)
 *     "ghl"       → solo Canale 2 (GHL)
 */
export default function WhatsAppPanel({ canale = 'tutti' }) {
  const [items, setItems]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [waStatus, setWaStatus] = useState(null)
  const [showQR, setShowQR]     = useState(false)
  const [selId, setSelId]       = useState(null)
  const [bozze, setBozze]       = useState({})
  const [filtro, setFiltro]     = useState('tutti')
  const [mostraVecchie, setMostraVecchie] = useState(false)

  const isCanale3 = canale !== 'ghl'

  const load = useCallback(async () => {
    if (DEMO_ATTIVA) {
      setItems((prev) => (prev.length ? prev : DEMO_ITEMS))
      setLoading(false)
      return
    }
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
    if (!isCanale3 || DEMO_ATTIVA) {
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

  function rimuovi(id) {
    setItems((prev) => prev.filter((i) => i.id !== id))
    setSelId((prev) => (prev === id ? null : prev))
  }

  const connesso = waStatus === 'pronto'
  const titoloPannello = 'WhatsApp' + (items.length > 0 ? ' (' + items.length + ')' : '')

  const nVecchie   = items.filter(eVecchia).length
  const base       = mostraVecchie ? items : items.filter((i) => !eVecchia(i))
  const nOperativo = base.filter((i) => canaleDi(i) === 'operativo').length
  const nGhl       = base.length - nOperativo
  const visibili   = filtro === 'tutti' ? base : base.filter((i) => canaleDi(i) === filtro)

  // Su schermo largo apre da solo la prima chat; su telefono resta la lista.
  const largo = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
  const selezionato = visibili.find((i) => i.id === selId) || (largo ? visibili[0] || null : null)

  function testoDi(item) {
    return bozze[item.id] !== undefined ? bozze[item.id] : (item.risposta_ai || '')
  }

  return (
    <Card
      title={titoloPannello}
      action={
        <div className="flex items-center gap-2">
          {isCanale3 && waStatus && (
            <span className={
              'rounded-full px-2 py-0.5 text-xs font-medium ' +
              (connesso ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')
            }>
              {connesso ? '● connesso' : '● disconnesso'}
            </span>
          )}
          {!isCanale3 && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
              ● GHL attivo
            </span>
          )}
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

      {DEMO_ATTIVA && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Modalità dimostrativa: chat finte, nessun messaggio viene inviato. Togli ?demo=1 dall'indirizzo per tornare ai dati veri.
        </div>
      )}

      {isCanale3 && showQR && (
        <div className="mb-3 flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-center text-xs text-slate-500">
            WhatsApp → Impostazioni → Dispositivi collegati → Collega un dispositivo
          </p>
          <img
            src={GATEWAY_URL + '/wa/qr?t=' + Date.now() + '&token=' + encodeURIComponent(getToken() || '')}
            alt="QR WhatsApp"
            className="rounded-lg border border-slate-200"
            style={{ width: 220, height: 220 }}
            onError={(e) => { e.target.style.display = 'none' }}
          />
          <p className="text-center text-xs text-slate-400">
            Se il QR non appare, WhatsApp è già connesso.
          </p>
        </div>
      )}

      {isCanale3 && waStatus && !connesso && !showQR && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          ⚠️ WhatsApp non connesso — clicca <strong>QR</strong> per scansionare.
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState message="Nessun messaggio in attesa" />
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-slate-500">
            Nessun messaggio parte senza la tua approvazione.
          </p>
          <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-slate-200 bg-white md:h-[70vh] md:grid-cols-[320px_1fr]">

            {/* Colonna sinistra: chat in attesa */}
            <div className={(selezionato ? 'hidden md:block' : 'block') + ' min-h-0 overflow-y-auto border-slate-200 md:border-r'}>
              {canale === 'tutti' && (
                <div className="sticky top-0 z-10 flex gap-1.5 border-b border-slate-100 bg-white px-3 py-2">
                  {[
                    { key: 'tutti',     label: 'Tutti',   n: base.length },
                    { key: 'operativo', label: 'OpenWA',  n: nOperativo },
                    { key: 'ghl',       label: 'GHL',     n: nGhl },
                  ].map(({ key, label, n }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFiltro(key)}
                      className={
                        'rounded-full border px-3 py-1 text-xs font-semibold transition ' +
                        (filtro === key
                          ? 'border-green-600 bg-green-600 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')
                      }
                    >
                      {label + ' ' + n}
                    </button>
                  ))}
                  {nVecchie > 0 && (
                    <button
                      type="button"
                      onClick={() => setMostraVecchie(!mostraVecchie)}
                      className="ml-auto rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500 hover:bg-slate-50"
                    >
                      {(mostraVecchie ? 'Nascondi vecchie ' : 'Vecchie ') + nVecchie}
                    </button>
                  )}
                </div>
              )}
              {visibili.length === 0 && (
                <p className="px-3 py-6 text-center text-xs text-slate-400">Nessuna chat in questo filtro</p>
              )}
              {visibili.map((item) => (
                <ChatRow
                  key={item.id}
                  item={item}
                  attiva={selezionato ? item.id === selezionato.id : false}
                  onPick={() => setSelId(item.id)}
                />
              ))}
            </div>

            {/* Colonna destra: conversazione + bozza */}
            <div className={(selezionato ? 'block' : 'hidden md:block') + ' min-h-0'}>
              {selezionato ? (
                <ChatDetail
                  key={selezionato.id}
                  item={selezionato}
                  testo={testoDi(selezionato)}
                  onTesto={(t) => setBozze((prev) => ({ ...prev, [selezionato.id]: t }))}
                  onSent={rimuovi}
                  onRejected={rimuovi}
                  onBack={() => setSelId(null)}
                />
              ) : (
                <div className="flex h-full items-center justify-center p-6 text-sm text-slate-400">
                  Scegli una chat a sinistra
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
