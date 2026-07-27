// src/components/panels/KbQueryPanel.jsx
// v3 — interfaccia chat conversazionale
//
// Il multi-turn non richiede modifiche al backend: lo storico viene
// serializzato come testo e passato nel campo "query" insieme alla nuova
// domanda. L'agente riceve tutto il contesto e può rispondere ai follow-up.

import { useEffect, useRef, useState } from 'react'
import { btnPrimary, Card, ErrorBanner, inputBase } from '../ui'

const GATEWAY_URL =
  import.meta.env.VITE_GATEWAY_URL ||
  'https://gateway-production-a488.up.railway.app'

const AGENTI = [
  { value: '',                  label: 'Seleziona agente…'                    },
  { value: 'AGENTE_CAF',        label: 'CAF — 730 / ISEE / PF'                },
  { value: 'AGENTE_PATRONATO',  label: 'Patronato — NASPi / Pensioni'          },
  { value: 'AGENTE_CONSULENZE', label: 'Consulenze — Successioni / Dimissioni' },
]

// Serializza la conversazione precedente come testo strutturato da passare
// all'agente insieme alla nuova domanda. Senza questo il modello risponde
// come se fosse il primo turno e non capisce i follow-up.
function buildQuery(messages, nuovaDomanda) {
  if (messages.length === 0) return nuovaDomanda
  const lines = ['CONVERSAZIONE PRECEDENTE (contesto — non ripetere, usa per rispondere al follow-up):']
  let turno = 1
  for (const m of messages) {
    if (m.role === 'user') {
      lines.push(`[T${turno}] OPERATORE: ${m.content}`)
    } else {
      lines.push(`[T${turno}] AGENTE: ${m.content}`)
      turno++
    }
  }
  lines.push('', 'NUOVA DOMANDA:', nuovaDomanda)
  return lines.join('\n')
}

// Singola bolla di messaggio
function Bubble({ msg }) {
  const [citOpen, setCitOpen] = useState(false)
  const isUser = msg.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[82%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? 'rounded-br-sm bg-slate-900 text-white'
            : 'rounded-bl-sm border border-slate-200 bg-white text-slate-800'
        }`}
      >
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>

        {msg.citazioni?.length > 0 && (
          <div className="mt-2 border-t border-white/10 pt-2">
            <button
              type="button"
              onClick={() => setCitOpen((o) => !o)}
              className={`text-xs hover:underline ${isUser ? 'text-slate-400' : 'text-blue-500'}`}
            >
              {citOpen
                ? '▲ nascondi citazioni'
                : `▼ ${msg.citazioni.length} citazion${msg.citazioni.length === 1 ? 'e' : 'i'} KB`}
            </button>
            {citOpen && (
              <ul className="mt-1.5 flex flex-col gap-1">
                {msg.citazioni.map((c, i) => (
                  <li
                    key={i}
                    className="rounded border border-emerald-100 bg-emerald-50 px-2 py-1 text-xs italic text-emerald-800"
                  >
                    "{c}"
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Indicatore di digitazione AI
function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3">
        <div className="flex gap-1">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="h-2 w-2 animate-bounce rounded-full bg-slate-400"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function KbQueryPanel() {
  const [messages, setMessages] = useState([])
  const [input,    setInput]    = useState('')
  const [agente,   setAgente]   = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)

  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  // Scrolla in fondo a ogni nuovo messaggio
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function reset() {
    setMessages([])
    setInput('')
    setError(null)
  }

  async function handleSubmit() {
    const q = input.trim()
    if (!q || !agente || loading) return

    const queryConStorico = buildQuery(messages, q)
    const conUtente = [...messages, { role: 'user', content: q }]
    setMessages(conUtente)
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${GATEWAY_URL}/operatore`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryConStorico, agente_dominio: agente }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || data.message || `HTTP ${res.status}`)
      }

      const testo =
        data.risposta        ??
        data.testo_operatore ??
        data.testo_cliente   ??
        JSON.stringify(data, null, 2)

      const raw = data.citazioni_kb ?? []
      const citazioni = Array.isArray(raw) ? raw : [raw].filter(Boolean)

      setMessages((prev) => [...prev, { role: 'assistant', content: testo, citazioni }])
    } catch (e) {
      setMessages(messages)
      setError(e.message || 'Errore di connessione al gateway.')
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const canSend = input.trim().length > 0 && agente !== '' && !loading
  const haChat  = messages.length > 0

  return (
    <Card
      label="Consulente AI KB"
      action={
        haChat && (
          <button
            type="button"
            onClick={reset}
            className="text-xs text-slate-400 transition hover:text-slate-600"
          >
            Nuova conversazione
          </button>
        )
      }
    >
      {/* Selezione agente — bloccata dopo il primo messaggio */}
      <div className="mb-3">
        <select
          className={`${inputBase} w-full`}
          value={agente}
          onChange={(e) => setAgente(e.target.value)}
          disabled={haChat}
          aria-label="Seleziona agente di dominio"
        >
          {AGENTI.map(({ value, label }) => (
            <option key={value || 'empty'} value={value}>
              {label}
            </option>
          ))}
        </select>
        {haChat && (
          <p className="mt-1 text-xs text-slate-400">
            Clicca "Nuova conversazione" per cambiare agente
          </p>
        )}
      </div>

      {/* Area messaggi */}
      <div className="mb-3 flex h-[460px] flex-col gap-3 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-4">
        {!haChat && !loading && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-center text-sm text-slate-400">
              Seleziona un agente e scrivi la tua domanda.
              <br />
              Puoi fare follow-up come in una chat normale.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <Bubble key={i} msg={msg} />
        ))}

        {loading && <TypingIndicator />}

        <div ref={bottomRef} />
      </div>

      <ErrorBanner message={error} />

      {/* Input */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          className={`${inputBase} flex-1`}
          type="text"
          placeholder={
            agente
              ? 'Scrivi una domanda… (Invio per inviare)'
              : 'Seleziona prima un agente'
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!agente || loading}
          aria-label="Messaggio"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSend}
          className={`${btnPrimary} shrink-0`}
          aria-busy={loading}
        >
          {loading ? '…' : 'Invia'}
        </button>
      </div>
    </Card>
  )
}
