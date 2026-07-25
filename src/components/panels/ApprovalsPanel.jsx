// src/components/panels/ApprovalsPanel.jsx
// Gamba 3 — Pannello approvazioni DA_APPROVARE
// Versione: 1.1 — 25 luglio 2026
//
// v1.1: mostra il MESSAGGIO DEL CLIENTE sopra la bozza.
//   Senza la domanda originale l'operatore non può giudicare se la risposta è
//   pertinente: approverebbe alla cieca proprio sui casi con conseguenza legale
//   diretta, cioè quelli per cui questo pannello esiste.
//   Aggiunto anche il nome del contatto quando disponibile.
//
// Mostra le risposte in attesa di approvazione operatore.
// Per ogni bozza: domanda cliente, testo modificabile, citazioni KB, Invia / Rifiuta.
// Real-time: polling ogni 15 secondi.

import { useCallback, useEffect, useState } from 'react'
import { Card, EmptyState, ErrorBanner, LoadingState, formatDateTime } from '../ui'

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'https://gateway-production-a488.up.railway.app'

async function fetchPending() {
  const res = await fetch(`${GATEWAY_URL}/approvals/pending`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return data.approvals || []
}

async function sendApproval({ approval_id, contact_id, testo_finale }) {
  const res = await fetch(`${GATEWAY_URL}/approvals/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approval_id, contact_id, testo_finale }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function rejectApproval(approval_id) {
  const res = await fetch(`${GATEWAY_URL}/approvals/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approval_id }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

function ApprovalCard({ item, onSent, onRejected }) {
  const [testo, setTesto] = useState(item.testo_risposta || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [citOpen, setCitOpen] = useState(false)

  const citazioni = item.citazioni_kb
    ? (Array.isArray(item.citazioni_kb) ? item.citazioni_kb : [item.citazioni_kb])
    : []

  const minutiAttesa = Math.floor(
    (Date.now() - new Date(item.created_at).getTime()) / 60000
  )
  const urgente = minutiAttesa >= 20

  async function handleSend() {
    if (!testo.trim()) return
    setLoading(true)
    setError(null)
    try {
      await sendApproval({
        approval_id: item.id,
        contact_id: item.contact_id,
        testo_finale: testo.trim(),
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
      await rejectApproval(item.id)
      onRejected(item.id)
    } catch (err) {
      setError('Errore rifiuto: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`rounded-xl border p-4 ${urgente ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {item.servizio || '—'}
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs font-medium text-slate-600">
              {item.contact_name || 'nome non noto'}
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-400">
              {item.contact_id || '—'}
            </span>
            {urgente && (
              <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-800">
                {minutiAttesa} min in attesa
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-slate-400">
            {formatDateTime(item.created_at)}
          </div>
        </div>
        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
          DA APPROVARE
        </span>
      </div>

      {/* Messaggio del cliente — v1.1
          È il riferimento per giudicare la risposta: sta sopra la bozza,
          in evidenza, non nascosto dietro un toggle. */}
      <div className="mb-3 rounded-lg border-l-4 border-slate-400 bg-slate-50 px-3 py-2">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Il cliente ha scritto
        </div>
        {item.messaggio_ricevuto ? (
          <p className="whitespace-pre-wrap text-sm text-slate-800">
            {item.messaggio_ricevuto}
          </p>
        ) : (
          <p className="text-sm italic text-slate-400">
            Messaggio non registrato (bozza creata prima della v1.1) —
            controlla la conversazione in GHL prima di approvare.
          </p>
        )}
      </div>

      {/* Motivo revisione */}
      {item.motivo && (
        <div className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
          <span className="font-medium">Motivo revisione:</span> {item.motivo}
        </div>
      )}

      {/* Bozza di risposta — modificabile */}
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Bozza di risposta
      </div>
      <textarea
        value={testo}
        onChange={e => setTesto(e.target.value)}
        rows={4}
        disabled={loading}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-60"
        placeholder="Testo della risposta..."
      />

      {/* Citazioni KB */}
      {citazioni.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setCitOpen(!citOpen)}
            className="text-xs text-blue-600 hover:underline"
          >
            {citOpen ? '▲ nascondi' : `▼ ${citazioni.length} citazion${citazioni.length === 1 ? 'e' : 'i'} KB`}
          </button>
          {citOpen && (
            <ul className="mt-1 space-y-1">
              {citazioni.map((c, i) => (
                <li key={i} className="rounded bg-emerald-50 border border-emerald-100 px-2 py-1 text-xs text-emerald-800 italic">
                  "{c}"
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Errore */}
      {error && (
        <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Azioni */}
      <div className="mt-3 flex gap-2">
        <button
          onClick={handleSend}
          disabled={loading || !testo.trim()}
          className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {loading ? 'Invio...' : '✓ Invia al cliente'}
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

export default function ApprovalsPanel() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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

  useEffect(() => {
    load()
    const interval = setInterval(load, 15000) // polling ogni 15s
    return () => clearInterval(interval)
  }, [load])

  function handleSent(id) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  function handleRejected(id) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  return (
    <Card
      title={`Risposte da approvare${items.length > 0 ? ` (${items.length})` : ''}`}
      action={
        <button
          onClick={load}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          Aggiorna
        </button>
      }
    >
      <ErrorBanner message={error} />

      {loading ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState message="Nessuna risposta in attesa di approvazione" />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-slate-500">
            Queste risposte contengono dati normativi con conseguenza legale diretta.
            Leggi la domanda del cliente, controlla che la bozza risponda davvero a
            quella, modifica se necessario, poi invia.
            Il cliente ha già ricevuto un messaggio ponte.
          </p>
          {items.map(item => (
            <ApprovalCard
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
