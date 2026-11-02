// src/components/panels/AppuntamentiPanel.jsx
// Appuntamenti dal Google Calendar di UP CAF (lettura via gateway /appuntamenti).
// Versione 2.0 — 2 novembre 2026
//   - griglia oraria stile Google Calendar (giorno/settimana), colori per servizio
//   - clic su un appuntamento → scheda con match GHL e REC
//   - REC: trascrizione dal microfono del browser (niente audio salvato) →
//     controllo del testo → 1 riassunto AI → nota su GHL + Supabase → Segretaria
// Regola Vite 8: zero template literal nel JSX — solo concatenazioni.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Card, ErrorBanner, LoadingState } from '../ui'

const GATEWAY_URL = 'https://gateway-production-4696.up.railway.app'
const GHL_CONTATTO_URL = 'https://app.gohighlevel.com/v2/location/otZi0Yae4nEnmUzTXzOD/contacts/detail/'

// ── Utilità ───────────────────────────────────────────────────────────────

function oraDi(iso) {
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}
function stessoGiorno(a, b) {
  return new Date(a).toDateString() === new Date(b).toDateString()
}
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

// Il calendario salva la descrizione come HTML: lo trasformo in testo semplice.
function pulisciDescrizione(html) {
  return (html || '')
    .replace(/<\/p>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .split('\n')
    .filter((r) => !/^\s*-{5,}\s*$/.test(r))
    .join('\n')
    .replace(/(Cancel|Reschedule)\s*\n?\s*https?:\/\/\S+/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
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

// Colori per tipo di servizio, come nei colori del tuo Google Calendar.
function coloreServizio(titolo) {
  const t = (titolo || '').toUpperCase()
  if (t.includes('PAUSA')) return 'bg-slate-200 border-slate-400 text-slate-600'
  if (t.includes('DISOCCUPAZIONE')) return 'bg-purple-200 border-purple-500 text-purple-950'
  if (t.includes('BONUS NIDO')) return 'bg-green-200 border-green-600 text-green-950'
  if (t.includes('DIMISSIONI')) return 'bg-emerald-200 border-emerald-600 text-emerald-950'
  if (t.includes('VERIFICA E CALCOLO') || t.includes('PENSION') || t.includes('DOMANDA DI'))
    return 'bg-orange-300 border-orange-600 text-orange-950'
  if (t.includes('MODELLO REDDITI') || t.includes('730')) return 'bg-amber-200 border-amber-600 text-amber-950'
  if (t.includes('BONUS MAMME') || t.includes('ISEE')) return 'bg-indigo-200 border-indigo-500 text-indigo-950'
  return 'bg-sky-200 border-sky-500 text-sky-950'
}

// ── Griglia oraria ────────────────────────────────────────────────────────
const ORA_INIZIO = 7
const ORA_FINE = 21
const PX_ORA = 60

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
    const e = Math.max(new Date(ev.end).getTime(), s + 15 * 60000)
    if (cluster.length && s >= fine) { chiudi(); fine = 0 }
    cluster.push({ ev, s, e })
    fine = Math.max(fine, e)
  }
  if (cluster.length) chiudi()
  return out
}

function BloccoEvento({ it, onSel }) {
  const { ev } = it
  const inizio = new Date(ev.start)
  const minuti = inizio.getHours() * 60 + inizio.getMinutes() - ORA_INIZIO * 60
  const top = Math.max(0, (minuti / 60) * PX_ORA)
  const alt = Math.max(14, ((it.e - it.s) / 3600000) * PX_ORA - 1)
  const corto = alt < 34
  const { cliente, servizio } = dividiTitolo(ev.titolo)
  const finito = new Date(ev.end).getTime() < Date.now()
  const larg = 100 / it.corsie

  return (
    <button
      type="button"
      onClick={onSel}
      style={{ top: top, height: alt, left: it.corsia * larg + '%', width: 'calc(' + larg + '% - 1px)' }}
      className={
        'absolute overflow-hidden rounded border-l-4 px-1 text-left text-[10px] leading-[13px] shadow-sm transition hover:brightness-95 ' +
        coloreServizio(ev.titolo) + (finito ? ' opacity-60' : '')
      }
    >
      {ev.nota && <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-red-600" title="Registrato" />}
      {corto ? (
        <span className="block truncate font-medium">{servizio || cliente}{servizio ? ' – ' + cliente : ''}</span>
      ) : (
        <>
          <span className="block truncate font-semibold">{servizio || cliente}</span>
          {servizio && <span className="block truncate">{cliente}</span>}
          <span className="block opacity-70">{oraDi(ev.start)}</span>
        </>
      )}
    </button>
  )
}

function Griglia({ giorni, lista, onSel }) {
  const ore = []
  for (let h = ORA_INIZIO; h < ORA_FINE; h++) ore.push(h)
  const altezza = (ORA_FINE - ORA_INIZIO) * PX_ORA
  const colonne = { gridTemplateColumns: '40px repeat(' + giorni.length + ', minmax(0, 1fr))' }
  const ora = new Date()
  const minutiOra = ora.getHours() * 60 + ora.getMinutes() - ORA_INIZIO * 60

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
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

      <div className="max-h-[72vh] overflow-y-auto">
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
                  <BloccoEvento key={it.ev.uid} it={it} onSel={() => onSel(it.ev.uid)} />
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Chip contatto GHL ─────────────────────────────────────────────────────
function ChipGhl({ ghl }) {
  if (ghl === undefined) return null
  if (!ghl) {
    return (
      <span className="w-fit rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
        Nessun contatto in GHL
      </span>
    )
  }
  if (ghl.candidati) {
    return (
      <span className="w-fit rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
        {ghl.candidati.length + ' contatti con questo nome: la nota resta solo qui'}
      </span>
    )
  }
  return (
    <a
      href={GHL_CONTATTO_URL + ghl.contact_id}
      target="_blank"
      rel="noopener noreferrer"
      className="w-fit rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-800 hover:bg-blue-200"
    >
      {'GHL ✓ ' + ghl.nome + ' · via ' + ghl.match + (ghl.affidabilita === 'media' ? ' (da verificare)' : '')}
    </a>
  )
}

// ── Registratore: microfono → testo → riassunto → nota ────────────────────
const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null

function Registratore({ ev, onSalvato }) {
  const [fase, setFase] = useState('pronto') // pronto | rec | pausa | revisione | salvataggio | fatto
  const [testo, setTesto] = useState('')
  const [parziale, setParziale] = useState('')
  const [errore, setErrore] = useState(null)
  const [esito, setEsito] = useState(null)
  const recRef = useRef(null)
  const attivoRef = useRef(false)

  useEffect(() => () => {
    attivoRef.current = false
    if (recRef.current) recRef.current.stop()
  }, [])

  function avvia() {
    if (!SR) {
      setErrore('Questo browser non supporta la trascrizione vocale: usa Chrome.')
      return
    }
    setErrore(null)
    const rec = new SR()
    rec.lang = 'it-IT'
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = (e) => {
      let finale = ''
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finale += r[0].transcript + ' '
        else interim += r[0].transcript
      }
      if (finale) setTesto((t) => (t + ' ' + finale).trim())
      setParziale(interim)
    }
    rec.onerror = (e) => {
      if (e.error === 'not-allowed') {
        attivoRef.current = false
        setErrore('Microfono bloccato: consenti l\'accesso dal lucchetto accanto all\'indirizzo.')
        setFase('pronto')
      }
    }
    // Chrome chiude la sessione dopo qualche secondo di silenzio: la riapro finché non premo Stop.
    rec.onend = () => {
      if (attivoRef.current) {
        try { rec.start() } catch { /* già riavviato */ }
      }
    }
    recRef.current = rec
    attivoRef.current = true
    rec.start()
    setFase('rec')
  }

  function ferma() {
    attivoRef.current = false
    if (recRef.current) recRef.current.stop()
    setParziale('')
    setFase('revisione')
  }

  // Pausa: smette di ascoltare (clienti che entrano, telefonate) e tiene il testo già raccolto.
  function pausa() {
    attivoRef.current = false
    if (recRef.current) recRef.current.stop()
    setParziale('')
    setFase('pausa')
  }

  async function salva() {
    setFase('salvataggio')
    setErrore(null)
    try {
      const ghl = ev.ghl && !ev.ghl.candidati ? ev.ghl : null
      const res = await fetch(GATEWAY_URL + '/appuntamenti/nota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: ev.uid,
          titolo: ev.titolo,
          start: ev.start,
          contact_id: ghl ? ghl.contact_id : null,
          trascrizione: testo,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status)
      setEsito(data)
      setFase('fatto')
      onSalvato()
    } catch (err) {
      setErrore('Salvataggio non riuscito: ' + err.message + '. Il testo è ancora qui sotto, riprova.')
      setFase('revisione')
    }
  }

  const btnBase = 'rounded-xl px-4 py-3 text-sm font-semibold transition disabled:opacity-50'

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      {ev.nota && fase === 'pronto' && (
        <div className="rounded-lg bg-green-50 px-3 py-2 text-xs text-green-900">
          <p className="mb-1 font-semibold">Già registrato · {new Date(ev.nota.aggiornata).toLocaleString('it-IT')}</p>
          <p className="whitespace-pre-wrap">{ev.nota.riassunto}</p>
        </div>
      )}

      {fase === 'pronto' && (
        <button type="button" onClick={avvia} className={btnBase + ' bg-red-600 text-white hover:bg-red-700'}>
          {ev.nota ? '● Registra di nuovo' : '● REC — inizia la registrazione'}
        </button>
      )}

      {(fase === 'rec' || fase === 'pausa') && (
        <>
          {fase === 'rec' ? (
            <div className="flex items-center gap-2 text-sm font-semibold text-red-700">
              <span className="h-3 w-3 animate-pulse rounded-full bg-red-600" />
              Sto ascoltando…
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-700">
              <span className="h-3 w-3 rounded-full bg-amber-500" />
              In pausa: non sto registrando
            </div>
          )}
          <p className="max-h-48 min-h-16 overflow-y-auto whitespace-pre-wrap rounded-lg bg-white px-3 py-2 text-sm text-slate-800">
            {testo}
            <span className="text-slate-400">{' ' + parziale}</span>
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            {fase === 'rec' ? (
              <button type="button" onClick={pausa} className={btnBase + ' flex-1 bg-amber-500 text-white hover:bg-amber-600'}>
                ❚❚ Pausa (entra qualcuno / telefonata)
              </button>
            ) : (
              <button type="button" onClick={avvia} className={btnBase + ' flex-1 bg-red-600 text-white hover:bg-red-700'}>
                ● Riprendi
              </button>
            )}
            <button type="button" onClick={ferma} className={btnBase + ' bg-slate-800 text-white hover:bg-slate-900'}>
              ■ Stop
            </button>
          </div>
        </>
      )}

      {(fase === 'revisione' || fase === 'salvataggio') && (
        <>
          <p className="text-xs text-slate-500">
            Controlla il testo e correggi se serve. L'audio non viene salvato.
          </p>
          <textarea
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            rows={8}
            disabled={fase === 'salvataggio'}
            className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-300"
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={avvia} disabled={fase === 'salvataggio'} className={btnBase + ' border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}>
              ● Continua a registrare
            </button>
            <button
              type="button"
              onClick={salva}
              disabled={fase === 'salvataggio' || testo.trim().length < 20}
              className={btnBase + ' flex-1 bg-green-600 text-white hover:bg-green-700'}
            >
              {fase === 'salvataggio' ? 'Riassumo e salvo…' : 'Riassumi e salva nota'}
            </button>
          </div>
        </>
      )}

      {fase === 'fatto' && esito && (
        <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-900">
          <p className="mb-1 font-semibold">
            Nota salvata{esito.ghl_nota_salvata ? ' su GHL e su Supabase' : ' su Supabase (non su GHL)'}
          </p>
          <p className="whitespace-pre-wrap text-xs">{esito.riassunto}</p>
        </div>
      )}

      {errore && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{errore}</div>}
    </div>
  )
}

// ── Scheda appuntamento (finestra) ────────────────────────────────────────
function SchedaEvento({ ev, onChiudi, onSalvato }) {
  const [dettagli, setDettagli] = useState(false)
  const { servizio, cliente } = dividiTitolo(ev.titolo)
  const testo = pulisciDescrizione(ev.descrizione)
  const tel = telefonoDi(testo)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onChiudi}>
      <div
        className="flex max-h-[92vh] w-full max-w-xl flex-col gap-3 overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-base font-bold text-slate-800">{cliente}</span>
            {servizio && (
              <span className={'w-fit rounded-full border-l-4 px-2 py-0.5 text-[11px] font-semibold ' + coloreServizio(ev.titolo)}>
                {servizio}
              </span>
            )}
            <span className="text-xs text-slate-500">
              {new Date(ev.start).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }) +
                ' · ' + oraDi(ev.start) + '–' + oraDi(ev.end)}
            </span>
            <span className="flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
              {tel && <a href={'tel:' + tel.replace(/\s/g, '')} className="font-medium text-slate-700 hover:underline">{tel}</a>}
              {ev.luogo && <span>{ev.luogo}</span>}
            </span>
            <ChipGhl ghl={ev.ghl} />
          </div>
          <button
            type="button"
            onClick={onChiudi}
            aria-label="Chiudi"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl text-slate-500 hover:bg-slate-100"
          >
            ×
          </button>
        </div>

        <Registratore ev={ev} onSalvato={onSalvato} />

        {testo && (
          <div>
            <button type="button" onClick={() => setDettagli(!dettagli)} className="text-xs text-slate-500 underline">
              {dettagli ? 'Nascondi dettagli' : 'Dettagli prenotazione'}
            </button>
            {dettagli && (
              <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
                {testo}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Pannello principale ───────────────────────────────────────────────────
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
    // niente aggiornamento automatico mentre una scheda è aperta: non deve toglierti la registrazione
    const t = setInterval(() => { if (!selUid) load() }, 120000)
    return () => clearInterval(t)
  }, [load, selUid])

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

          <Griglia giorni={giorni} lista={lista} onSel={setSelUid} />
          <p className="text-center text-xs text-slate-400">Tocca un appuntamento per aprire la scheda e registrare</p>
        </div>
      )}

      {selezionato && (
        <SchedaEvento
          key={selezionato.uid}
          ev={selezionato}
          onChiudi={() => setSelUid(null)}
          onSalvato={load}
        />
      )}
    </Card>
  )
}
