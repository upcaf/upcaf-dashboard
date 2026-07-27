// src/components/panels/WhatsAppPanel.jsx
// Canale 3 — Pannello messaggi WhatsApp operativo
// Versione: 1.0 — 27 luglio 2026

import { useCallback, useEffect, useState } from 'react'
import { Card, EmptyState, ErrorBanner, LoadingState, formatDateTime } from '../ui'

const CANALE3_URL = 'https://gateway-production-4696.up.railway.app'

async function fetchPending() {
  const res = await fetch(`${CANALE3_URL}/wa/pending`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return data.pending || []
}

async function sendMessage({ pending_id, numero, testo_finale }) {
  const res = await fetch(`${CANALE3_URL}/openwa/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pending_id, numero, testo_finale }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function rejectMessage(pending_id) {
  const res = await fetch(`${CANALE3_URL}/wa/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pending_id }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

function WhatsAppCard({ item, onSent, onRejected }) {
  const [testo, setTesto] = useState(item.risposta_ai || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const minutiAttesa = Math.floor(
    (Date.now() - new Date(item.created_at).getTime()) / 60000
  )
  const urgente = minutiAttesa >= 10

  async function handleSend() {
    if (!testo.trim()) return
    setLoading(true)
    setError(null)
    try {
      await sendMessage({ pending_id: item.id, numero: item.numero, testo_finale: testo.trim() })
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

  return (
    <div className={`rounded-xl border p-4 ${urgente ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Canale 3</span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs font-medium text-slate-600">{item.nome_cliente || 'nome non noto'}</span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-400">{item.numero || '—'}</span>
            {urgente && (
              <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-800">
                {minutiAttesa} min in attesa
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-slate-400">{formatDateTime(item.created_at)}</div>
        </div>
        <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
          WA OPERATIVO
        </span>
      </div>

      <div className="mb-3 rounded-lg border-l-4 border-slate-400 bg-slate-50 px-3 py-2">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Il cliente ha scritto</div>
        <p className="whitespace-pre-wrap text-sm text-slate-800">{item.messaggio_ricevuto || '—'}</p>
      </div>

      {item.sintesi_agente && (
        <div className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
          <span className="font-medium">Sintesi AI:</span> {item.sintesi_agente}
        </div>
      )}

      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Bozza di risposta</div>
      <textarea
        value={testo}
        onChange={e => setTesto(e.target.value)}
        rows={4}
        disabled={loading}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-green-300 disabled:opacity-60"
        placeholder="Scrivi o modifica la risposta..."
      />

      {error && (
        <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
      )}

      <div className="mt-3 flex gap-2">
        <button
          onClick={handleSend}
          disabled={loading || !testo.trim()}
          className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {loading ? 'Invio...' : '✓ Invia su WhatsApp'}
        </button>
        <button
          onClick={handleReject}
          disabled={loading}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
        >
          Rifiuta
        </button>
      </div>
    </div>
  )
}

export default function WhatsAppPanel() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [waStatus, setWaStatus] = useState(null)
  const [showQR, setShowQR] = useState(false)

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
      const res = await fetch(`${CANALE3_URL}/health`)
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

  function handleSent(id) { setItems(prev => prev.filter(i => i.id !== id)) }
  function handleRejected(id) { setItems(prev => prev.filter(i => i.id !== id)) }

  return (
    <Card
      title={`WhatsApp Operativo${items.length > 0 ? ` (${items.length})` : ''}`}
      action={
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            waStatus === 'pronto' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {waStatus === 'pronto' ? '● connesso' : '● disconnesso'}
          </span>
          <button
            onClick={() => setShowQR(!showQR)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            QR
          </button>
          <button onClick={load} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50">
            Aggiorna
          </button>
        </div>
      }
    >
      <ErrorBanner message={error} />

      {/* QR inline — si apre cliccando il bottone QR */}
      {showQR && (
        <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col items-center gap-2">
          <p className="text-xs text-slate-500">
            Scansiona con WhatsApp → Impostazioni → Dispositivi collegati → Collega un dispositivo
          </p>
          <img
            src={`${CANALE3_URL}/wa/qr?t=${Date.now()}`}
            alt="QR WhatsApp"
            className="rounded-lg border border-slate-200"
            style={{ width: 220, height: 220 }}
            onError={e => { e.target.style.display = 'none' }}
          />
          <p className="text-xs text-slate-400">
            Se il QR non appare, WhatsApp è già connesso oppure ricarica tra qualche secondo.
          </p>
        </div>
      )}

      {waStatus && waStatus !== 'pronto' && !showQR && (
        <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          ⚠️ WhatsApp non connesso — clicca <strong>QR</strong> per scansionare il codice.
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState message="Nessun messaggio in attesa" />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-slate-500">
            Messaggi ricevuti sul numero operativo. La bozza è generata dall'AI —
            modificala se necessario, poi invia. Nessun messaggio parte senza la tua approvazione.
          </p>
          {items.map(item => (
            <WhatsAppCard key={item.id} item={item} onSent={handleSent} onRejected={handleRejected} />
          ))}
        </div>
      )}
    </Card>
  )
}
