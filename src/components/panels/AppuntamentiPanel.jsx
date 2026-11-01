// src/components/panels/AppuntamentiPanel.jsx
// Appuntamenti dal Google Calendar di UP CAF (sola lettura, via gateway /appuntamenti).
// Versione 1.2 — 1 novembre 2026
//   v1.2: vista a giorni/settimana stile Google Calendar (griglia oraria); clic su un
//         appuntamento apre la scheda sotto la griglia.
// Versione 1.1 — 1 novembre 2026
//   - da oggi in poi (passati nascosti, bottone "Passati N")
//   - descrizione ripulita dall'HTML e dai link annulla/sposta, aperta con "Dettagli"
//   - servizio e cliente separati dal titolo "SERVIZIO -- Cliente", telefono in evidenza
// Prossimo passo: nota vocale + riassunto per appuntamento.
// Regola Vite 8: zero template literal nel JSX — solo concatenazioni.

import { useCallback, useEffect, useState } from 'react'
import { Card, ErrorBanner, LoadingState } from '../ui'

const GATEWAY_URL = 'https://gateway-production-4696.up.railway.app'
const GHL_CONTATTO_URL = 'https://app.gohighlevel.com/v2/location/otZi0Yae4nEnmUzTXzOD/contacts/detail/'

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

// Esito del match con i contatti GHL (telefono → email → nome)
function ChipGhl({ ghl }) {
  if (ghl === undefined) return null
  if (!ghl) {
    return (
      <span className="w-fit rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
        Nessun contatto in GHL
      </span>
    )
  }
  if (ghl.candidati) {
    return (
      <span className="w-fit rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
        {ghl.candidati.length + ' contatti con questo nome: da scegliere'}
      </span>
    )
  }
  return (
    <a
      href={GHL_CONTATTO_URL + ghl.contact_id}
      target="_blank"
      rel="noopener noreferrer"
      className="w-fit rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800 hover:bg-blue-200"
    >
      {'GHL ✓ ' + ghl.nome + ' · via ' + ghl.match + (ghl.affidabilita === 'media' ? ' (da verificare)' : '')}
    </a>
  )
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
          <ChipGhl ghl={ev.ghl} />
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

// ── Griglia oraria ────────────────────────────────────────────────────────
const ORA_INIZIO = 7
const ORA_FINE = 21
const PX_ORA = 52

function inizioGiorno(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
function aggiungiGiorni(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
function lunediDi(d) {
  const x = inizioGiorno(d)
  return aggiungiGiorni(x, -((x.getDay() + 6) % 7))
}

// Affianca gli appuntamenti che si sovrappongono (come fa Google Calendar).
function disponi(eventi) {
  const out = []
  let cluster = []
  let fine = 0
  function chiudi() {
    const corsie = []
    for (const it of cluster) {
      let l = corsie.findIndex((f) => f <= it.s)
      if (l === -1) { l = corsie.length; corsie.push(0) }
      corsie[l] = it.e
      it.corsia = l
    }
    for (const it of cluster) { it.corsie = corsie.length; out.push(it) }
    cluster = []
  }
  for (const ev of eventi) {
    const s = new Date(ev.start).getTime()
    const e = Math.max(new Date(ev.end).getTime(), s + 25 * 60000)
    if (cluster.length && s >= fine) { chiudi(); fine = 0 }
    cluster.push({ ev, s, e })
    fine = Math.max(fine, e)
  }
  if (cluster.length) chiudi()
  return out
}

function BloccoEvento({ it, selezionato, onSel }) {
  const { ev } = it
  const inizio = new Date(ev.start)
  const minuti = inizio.getHours() * 60 + inizio.getMinutes() - ORA_INIZIO * 60
  const top = Math.max(0, (minuti / 60) * PX_ORA)
  const alt = Math.max(22, ((it.e - it.s) / 3600000) * PX_ORA - 2)
  const { cliente } = dividiTitolo(ev.titolo)
  const finito = new Date(ev.end).getTime() < Date.now()
  const bordo = ev.ghl === undefined ? 'border-green-600' : ev.ghl && !ev.ghl.candidati ? 'border-blue-600' : 'border-amber-500'
  const larg = 100 / it.corsie

  return (
    <button
      type="button"
      onClick={onSel}
      style={{ top: top, height: alt, left: it.corsia * larg + '%', width: larg + '%' }}
      className={
        'absolute overflow-hidden rounded-md border-l-4 px-1.5 py-0.5 text-left text-[11px] leading-tight shadow-sm transition ' +
        bordo + ' ' +
        (selezionato ? 'bg-green-200 ring-2 ring-green-600' : 'bg-green-100 hover:bg-green-200') +
        (finito ? ' opacity-60' : '')
      }
    >
      <span className="block font-semibold text-slate-800">{oraDi(ev.start)}</span>
      <span className="block truncate text-slate-700">{cliente}</span>
    </button>
  )
}

function Griglia({ giorni, lista, selUid, onSel }) {
  const ore = []
  for (let h = ORA_INIZIO; h < ORA_FINE; h++) ore.push(h)
  const altezza = (ORA_FINE - ORA_INIZIO) * PX_ORA
  const colonne = { gridTemplateColumns: '40px repeat(' + giorni.length + ', minmax(0, 1fr))' }
  const ora = new Date()
  const minutiOra = ora.getHours() * 60 + ora.getMinutes() - ORA_INIZIO * 60

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {/* intestazione giorni */}
      <div className="grid border-b border-slate-200" style={colonne}>
        <div />
        {giorni.map((g) => {
          const oggi = stessoGiorno(g, new Date())
          const interi = lista.filter((e) => e.giornata_intera && stessoGiorno(e.start, g))
          return (
            <div key={g.toISOString()} className="border-l border-slate-100 px-1 py-1.5 text-center">
              <div className="text-[10px] font-semibold uppercase text-slate-500">
                {g.toLocaleDateString('it-IT', { weekday: 'short' })}
              </div>
              <div className={'mx-auto flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ' + (oggi ? 'bg-green-600 text-white' : 'text-slate-800')}>
                {g.getDate()}
              </div>
              {interi.map((e) => (
                <div key={e.uid} className="mt-0.5 truncate rounded bg-slate-100 px-1 text-[10px] text-slate-600">
                  {e.titolo}
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* corpo con scorrimento verticale */}
      <div className="max-h-[68vh] overflow-y-auto">
        <div className="grid" style={colonne}>
          <div className="relative" style={{ height: altezza }}>
            {ore.map((h) => (
              <span key={h} style={{ top: (h - ORA_INIZIO) * PX_ORA - 6 }} className="absolute right-1 text-[10px] text-slate-400">
                {h + ':00'}
              </span>
            ))}
          </div>
          {giorni.map((g) => {
            const doggi = stessoGiorno(g, new Date())
            const eventi = lista
              .filter((e) => !e.giornata_intera && stessoGiorno(e.start, g))
              .sort((a, b) => a.start.localeCompare(b.start))
            return (
              <div key={g.toISOString()} className="relative border-l border-slate-100" style={{ height: altezza }}>
                {ore.map((h) => (
                  <div key={h} style={{ top: (h - ORA_INIZIO) * PX_ORA }} className="absolute inset-x-0 border-t border-slate-100" />
                ))}
                {doggi && minutiOra >= 0 && minutiOra <= (ORA_FINE - ORA_INIZIO) * 60 && (
                  <div style={{ top: (minutiOra / 60) * PX_ORA }} className="absolute inset-x-0 z-10 border-t-2 border-red-500" />
                )}
                {disponi(eventi).map((it) => (
                  <BloccoEvento key={it.ev.uid} it={it} selezionato={it.ev.uid === selUid} onSel={() => onSel(it.ev.uid)} />
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function AppuntamentiPanel() {
  const [lista, setLista] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [vista, setVista] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'giorno' : 'settimana')
  const [ancora, setAncora] = useState(() => inizioGiorno(new Date()))
  const [selUid, setSelUid] = useState(null)

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

  const giorni = vista === 'giorno'
    ? [ancora]
    : Array.from({ length: 7 }, (_, i) => aggiungiGiorni(lunediDi(ancora), i))
  const passo = vista === 'giorno' ? 1 : 7
  const titolo = vista === 'giorno'
    ? ancora.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
    : giorni[0].toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) + ' – ' +
      giorni[6].toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
  const selezionato = lista.find((e) => e.uid === selUid) || null

  const btn = 'rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50'

  return (
    <Card
      title="Appuntamenti"
      action={
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-slate-200 text-sm">
            {[['giorno', 'Giorno'], ['settimana', 'Settimana']].map(([k, l]) => (
              <button
                key={k}
                type="button"
                onClick={() => setVista(k)}
                className={'px-3 py-1.5 ' + (vista === k ? 'bg-green-600 text-white' : 'text-slate-600 hover:bg-slate-50')}
              >
                {l}
              </button>
            ))}
          </div>
          <button onClick={load} className={btn}>↺</button>
        </div>
      }
    >
      <ErrorBanner message={error} />
      {loading ? (
        <LoadingState />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <button type="button" className={btn} onClick={() => setAncora(inizioGiorno(new Date()))}>Oggi</button>
            <button type="button" className={btn} aria-label="Indietro" onClick={() => setAncora(aggiungiGiorni(ancora, -passo))}>‹</button>
            <button type="button" className={btn} aria-label="Avanti" onClick={() => setAncora(aggiungiGiorni(ancora, passo))}>›</button>
            <span className="text-sm font-semibold capitalize text-slate-800">{titolo}</span>
          </div>

          <Griglia giorni={giorni} lista={lista} selUid={selUid} onSel={(u) => setSelUid(u === selUid ? null : u)} />

          {selezionato ? <Evento key={selezionato.uid} ev={selezionato} /> : (
            <p className="text-center text-xs text-slate-400">Tocca un appuntamento per vedere la scheda</p>
          )}
        </div>
      )}
    </Card>
  )
}
