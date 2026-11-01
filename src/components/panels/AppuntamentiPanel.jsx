// src/components/panels/AppuntamentiPanel.jsx
// Appuntamenti dal Google Calendar di UP CAF (sola lettura, via gateway /appuntamenti).
// Versione 1.1 — 1 novembre 2026
//   - da oggi in poi (passati nascosti, bottone "Passati N")
//   - descrizione ripulita dall'HTML e dai link annulla/sposta, aperta con "Dettagli"
//   - servizio e cliente separati dal titolo "SERVIZIO -- Cliente", telefono in evidenza
// Prossimo passo: nota vocale + riassunto per appuntamento.
// Regola Vite 8: zero template literal nel JSX — solo concatenazioni.

import { useCallback, useEffect, useState } from 'react'
import { Card, EmptyState, ErrorBanner, LoadingState } from '../ui'

const GATEWAY_URL = 'https://gateway-production-4696.up.railway.app'

function giornoChiave(iso) {
  return new Date(iso).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
}

function oraDi(iso) {
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

function stessoGiorno(a, b) {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

// Il calendario salva la descrizione come HTML: lo trasformo in testo semplice.
function pulisciDescrizione(html) {
  let t = (html || '')
    .replace(/<\/p>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
  // via i link di appuntamento (annulla/sposta) e le righe di separazione
  t = t
    .split('\n')
    .filter((r) => !/^\s*-{5,}\s*$/.test(r))
    .join('\n')
    .replace(/(Cancel|Reschedule)\s*\n?\s*https?:\/\/\S+/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return t
}

function telefonoDi(testo) {
  const m = testo.match(/NUMERO DI TELEFONO\s*\n?\s*(\+?[\d ]{8,})/i)
  return m ? m[1].trim() : null
}

// "DISOCCUPAZIONE - NASPI -- Mihaiela Rosca" → servizio + cliente
function dividiTitolo(titolo) {
  const i = titolo.indexOf(' -- ')
  if (i === -1) return { servizio: null, cliente: titolo }
  return { servizio: titolo.slice(0, i).trim(), cliente: titolo.slice(i + 4).trim() }
}

function Evento({ ev }) {
  const [aperto, setAperto] = useState(false)
  const { servizio, cliente } = dividiTitolo(ev.titolo)
  const testo = pulisciDescrizione(ev.descrizione)
  const tel = telefonoDi(testo)
  const finito = new Date(ev.end).getTime() < Date.now()

  return (
    <div className={'rounded-xl border bg-white px-3 py-2.5 ' + (finito ? 'border-slate-100 opacity-60' : 'border-slate-200')}>
      <div className="flex items-start gap-3">
        <div className="w-24 shrink-0 text-sm font-semibold text-green-700">
          {ev.giornata_intera ? 'Tutto il giorno' : oraDi(ev.start) + '–' + oraDi(ev.end)}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-semibold text-slate-800">{cliente}</span>
          {servizio && (
            <span className="w-fit rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-800">
              {servizio}
            </span>
          )}
          <span className="flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
            {tel && <a href={'tel:' + tel.replace(/\s/g, '')} className="font-medium text-slate-700 hover:underline">{tel}</a>}
            {ev.luogo && <span className="truncate">{ev.luogo}</span>}
          </span>
        </div>
        {testo && (
          <button
            type="button"
            onClick={() => setAperto(!aperto)}
            className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            {aperto ? 'Chiudi' : 'Dettagli'}
          </button>
        )}
      </div>
      {aperto && testo && (
        <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
          {testo}
        </p>
      )}
    </div>
  )
}

export default function AppuntamentiPanel() {
  const [lista, setLista] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [passati, setPassati] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(GATEWAY_URL + '/appuntamenti')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status)
      setLista(data.appuntamenti || [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 120000)
    return () => clearInterval(t)
  }, [load])

  const inizioOggi = new Date()
  inizioOggi.setHours(0, 0, 0, 0)
  const nPassati = lista.filter((e) => new Date(e.start) < inizioOggi).length
  const visibili = passati ? lista : lista.filter((e) => new Date(e.start) >= inizioOggi)

  const gruppi = []
  for (const ev of visibili) {
    const k = giornoChiave(ev.start)
    const ultimo = gruppi[gruppi.length - 1]
    if (ultimo && ultimo.k === k) ultimo.eventi.push(ev)
    else gruppi.push({ k, start: ev.start, eventi: [ev] })
  }

  return (
    <Card
      title={'Appuntamenti' + (visibili.length ? ' (' + visibili.length + ')' : '')}
      action={
        <div className="flex items-center gap-2">
          {nPassati > 0 && (
            <button
              onClick={() => setPassati(!passati)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              {passati ? 'Nascondi passati' : 'Passati ' + nPassati}
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
      {loading ? (
        <LoadingState />
      ) : visibili.length === 0 && !error ? (
        <EmptyState message="Nessun appuntamento nei prossimi giorni" />
      ) : (
        <div className="flex flex-col gap-4">
          {gruppi.map((g) => (
            <div key={g.k} className="flex flex-col gap-1.5">
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {g.k}
                {stessoGiorno(g.start, new Date()) && (
                  <span className="rounded-full bg-green-600 px-2 py-0.5 text-[10px] font-bold text-white">OGGI</span>
                )}
              </h3>
              {g.eventi.map((ev) => (
                <Evento key={ev.uid} ev={ev} />
              ))}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
