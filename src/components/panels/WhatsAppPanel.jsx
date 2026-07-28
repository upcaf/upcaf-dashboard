// src/components/panels/WhatsAppPanel.jsx
// Canale 3 — Pannello messaggi WhatsApp operativo
// Versione: 1.2 — mobile-friendly
//
// v1.2: ottimizzazione mobile.
//   - Bottoni Invia / Rifiuta a tutta larghezza, impilati verticalmente su schermi stretti
//   - Textarea con rows={5} per più spazio di lettura/modifica su telefono
//   - Selettore motivo a griglia 2 colonne (si legge meglio con il pollice)
//   - Badge urgenza più visibile
//   - Header card semplificato su mobile (canale + nome su righe separate)
//   - Nessuna regressione sul comportamento: tutta la logica v1.1 è invariata
//
// Regola Vite 8: zero template literal nel JSX — solo concatenazioni.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, EmptyState, ErrorBanner, LoadingState, formatDateTime } from '../ui'

const CANALE3_URL = 'https://gateway-production-4696.up.railway.app'

const MOTIVO_OBBLIGATORIO = true

const MOTIVI = [
  { key: 'dato_sbagliato',       label: 'Dato sbagliato',       hint: 'Il numero era errato' },
  { key: 'dato_superato',        label: 'Dato superato',        hint: 'La KB era vecchia' },
  { key: 'mancava_info',         label: 'Mancava info',         hint: 'Risposta incompleta' },
  { key: 'promessa_impossibile', label: 'Promessa impossibile', hint: 'Il sistema non può onorarla' },
  { key: 'troppo_lungo',         label: 'Troppo lungo',         hint: 'Stile WhatsApp' },
  { key: 'tono',                 label: 'Tono',                 hint: 'Forma, non contenuto' },
]

async function fetchPending() {
  const res = await fetch(CANALE3_URL + '/wa/pending')
  if (!res.ok) throw new Error('HTTP ' + res.status)
  const data = await res.json()
  return data.pending || []
}

async function sendMessage({ pending_id, numero, testo_finale, motivo_correzione }) {
  const res = await fetch(CANALE3_URL + '/openwa/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pending_id, numero, testo_finale, motivo_correzione }),
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

async function rejectMessage(pending_id) {
  const res = await fetch(CANALE3_URL + '/wa/reject', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pending_id }),
  })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return res.json()
}

function WhatsAppCard({ item, onSent, onRejected }) {
  const bozzaOriginale = item.risposta_ai || ''
  const senzaBozza = !bozzaOriginale.trim()

  const [testo, setTesto]   = useState(bozzaOriginale)
  const [motivo, setMotivo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState(null)

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
    try {
      await sendMessage({
        pending_id: item.id,
        numero: item.numero,
        testo_finale: testo.trim(),
        motivo_correzione: modificato ? motivo : null,
      })
      onSent(item.id)
    } catch (err) {
      setError('Errore invio: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleReject() {
    setLoading(true)
    setError(null)
    try {
      await rejectMessage(item.id)
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
          <span className="text-xs text-slate-400">{item.numero || '—'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
            WA OPERATIVO
          </span>
          <span className="text-xs text-slate-400">{formatDateTime(item.created_at)}</span>
        </div>
      </div>

      {/* ── Messaggio cliente ── */}
      <div className="mb-3 rounded-lg border-l-4 border-slate-400 bg-slate-50 px-3 py-2">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Il cliente ha scritto
        </div>
        <p className="whitespace-pre-wrap text-sm text-slate-800">{item.messaggio_ricevuto || '—'}</p>
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

      {/* ── Errore ── */}
      {error && (
        <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
      )}

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
              : '✓ Invia su WhatsApp'}
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

export default function WhatsAppPanel() {
  const [items, setItems]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [waStatus, setWaStatus] = useState(null)
  const [showQR, setShowQR]     = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await fetchPending()
      setItems(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const checkStatus = useCallback(async () => {
    try {
      const res  = await fetch(CANALE3_URL + '/health')
      const data = await res.json()
      setWaStatus(data.wa_canale3 || 'sconosciuto')
    } catch {
      setWaStatus('non raggiungibile')
    }
  }, [])

  useEffect(() => {
    load()
    checkStatus()
    const i1 = setInterval(load, 10000)
    const i2 = setInterval(checkStatus, 30000)
    return () => { clearInterval(i1); clearInterval(i2) }
  }, [load, checkStatus])

  function handleSent(id)     { setItems((prev) => prev.filter((i) => i.id !== id)) }
  function handleRejected(id) { setItems((prev) => prev.filter((i) => i.id !== id)) }

  const connesso = waStatus === 'pronto'

  return (
    <Card
      title={'WhatsApp Operativo' + (items.length > 0 ? ' (' + items.length + ')' : '')}
      action={
        <div className="flex items-center gap-2">
          <span className={
            'rounded-full px-2 py-0.5 text-xs font-medium ' +
            (connesso ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')
          }>
            {connesso ? '● connesso' : '● disconnesso'}
          </span>
          <button
            onClick={() => setShowQR(!showQR)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            QR
          </button>
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

      {showQR && (
        <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col items-center gap-2">
          <p className="text-xs text-slate-500 text-center">
            WhatsApp → Impostazioni → Dispositivi collegati → Collega un dispositivo
          </p>
          <img
            src={CANALE3_URL + '/wa/qr?t=' + Date.now()}
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

      {waStatus && !connesso && !showQR && (
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
              onSent={handleSent}
              onRejected={handleRejected}
            />
          ))}
        </div>
      )}
    </Card>
  )
}
