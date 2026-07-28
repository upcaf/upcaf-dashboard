// src/components/panels/SessionsPanel.jsx
// Sessioni AI — raggruppate per contatto
// Versione: 2.2 — 28 luglio 2026
//
// v2.2: eliminati TUTTI i template literal dentro il JSX, sostituiti da
// concatenazioni. Il parser di Vite 8 (rolldown/oxc) falliva su questo file
// con "Unexpected token" senza che sia stato possibile isolare il costrutto
// esatto: gli stessi pattern funzionano altrove nel progetto. Le concatenazioni
// sono meno leggibili ma non lasciano margine di interpretazione al parser.
// Il tag <a> del footer del drawer è su una riga sola per la stessa ragione.
//
// v2.0: una riga per CLIENTE, non per messaggio. Il pannello si usa in tre
// contesti tramite la prop canale:
//   nessuna prop                    -> tutti i canali
//   canale="ghl"                    -> whatsapp_inbound + record legacy (NULL)
//   canale="whatsapp_operativo"     -> Canale 3
//
// Lo stato mostrato e' session_logs.esito per ENTRAMBI i canali (decisione del
// 28 luglio: GHL e Canale 3 uguali). Conseguenza da tenere a mente: e' l'esito
// della PIPELINE, non l'azione finale dell'operatore. Una bozza Canale 3 gia'
// inviata resta "in attesa operatore" qui — l'azione vera si legge nel pannello
// WA Operativo e in Correzioni AI.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  btnPrimary,
  Card,
  EmptyState,
  ErrorBanner,
  formatDateTime,
  inputBase,
  LoadingState,
  pillClass,
  rowSub,
  sectionLabel,
} from '../ui'

const GHL_LOCATION_ID = 'otZi0Yae4nEnmUzTXzOD'

// Righe grezze lette da session_logs prima del raggruppamento.
// Alta perche' una conversazione lunga occupa piu' righe di un contatto.
const RIGHE_MAX = 400
const GRUPPI_DEFAULT = 15

const ESITO_VARIANT = {
  risolto: 'green',
  handoff: 'amber',
  handoff_attivo: 'amber',
  da_approvare: 'blue',
  in_attesa_operatore: 'blue',
  errore: 'red',
}

const ESITO_LABEL = {
  in_attesa_operatore: 'in attesa operatore',
  handoff_attivo: 'handoff attivo',
  da_approvare: 'da approvare',
}

const CIFRE = '0123456789'

function esitoLabel(esito) {
  if (!esito) return '—'
  return ESITO_LABEL[esito] || esito
}

function shortId(id) {
  if (!id) return '—'
  if (id.length <= 14) return id
  return id.slice(0, 8) + '…' + id.slice(-4)
}

function isCanale3(canale) {
  return canale === 'whatsapp_operativo'
}

// Estrae le sole cifre senza regex: il link wa.me vuole solo numeri.
function soloCifre(valore) {
  const testo = String(valore || '')
  let out = ''
  for (let i = 0; i < testo.length; i++) {
    if (CIFRE.indexOf(testo[i]) !== -1) out += testo[i]
  }
  return out
}

// Il nome cliente non vive in session_logs. Lo cerchiamo in contacts senza
// dare per scontato il nome della colonna: select('*') non puo' fallire per
// colonna inesistente, e qui sotto proviamo i nomi plausibili in ordine.
function estraiNome(riga) {
  if (!riga) return null
  const candidati = ['name', 'contact_name', 'nome', 'nome_cliente', 'full_name']
  for (const c of candidati) {
    const v = riga[c]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}

function TurnoBlocco({ turno, indice }) {
  const t = turno

  let meta = t.agente_dominio || t.agente_destinatario || 'agente non registrato'
  if (t.esito_qg) meta = meta + ' · QG: ' + t.esito_qg
  if (t.ms_totali) meta = meta + ' · ' + t.ms_totali + ' ms'

  const citazioni = Array.isArray(t.citazioni_kb) ? t.citazioni_kb : []

  return (
    <div className="rounded-lg border border-uc-border">
      <div className="flex flex-wrap items-center gap-2 border-b border-uc-border px-3 py-2">
        <span className={sectionLabel}>Turno {indice}</span>
        <span className={rowSub}>{formatDateTime(t.created_at)}</span>
        <span className="ml-auto">
          <span className={pillClass(ESITO_VARIANT[t.esito] || 'neutral')}>
            {esitoLabel(t.esito)}
          </span>
        </span>
      </div>

      <div className="space-y-3 px-3 py-3">
        {t.testo_cliente ? (
          <div>
            <p className={sectionLabel}>Cliente</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-uc-ink">{t.testo_cliente}</p>
          </div>
        ) : null}

        <div>
          <p className={sectionLabel}>Risposta AI</p>
          {t.testo_risposta ? (
            <p className="mt-1 whitespace-pre-wrap rounded-lg bg-[rgba(0,166,61,0.06)] px-3 py-2 text-sm text-uc-ink">
              {t.testo_risposta}
            </p>
          ) : (
            <p className="mt-1 text-xs italic text-uc-muted">nessuna risposta registrata</p>
          )}
        </div>

        {citazioni.length > 0 ? (
          <div>
            <p className={sectionLabel}>Citazioni KB ({citazioni.length})</p>
            <div className="mt-1 space-y-1">
              {citazioni.map((c, k) => (
                <p key={k} className="rounded-lg bg-[rgba(46,111,242,0.06)] px-3 py-1.5 text-xs italic text-uc-ink">
                  {c}
                </p>
              ))}
            </div>
          </div>
        ) : null}

        {t.motivo_handoff ? (
          <div>
            <p className={sectionLabel}>Motivo handoff</p>
            <p className="mt-1 rounded-lg bg-[rgba(192,133,50,0.08)] px-3 py-2 text-xs text-uc-amber">
              {t.motivo_handoff}
            </p>
          </div>
        ) : null}

        <p className={rowSub}>{meta}</p>
      </div>
    </div>
  )
}

function ThreadDrawer({ gruppo, onClose }) {
  if (!gruppo) return null

  const canale3 = isCanale3(gruppo.canale)
  // In ordine cronologico: si legge la conversazione, non il log.
  const turni = [].concat(gruppo.turni).reverse()

  const hrefLink = canale3
    ? 'https://wa.me/' + soloCifre(gruppo.contact_id)
    : 'https://app.gohighlevel.com/v2/location/' + GHL_LOCATION_ID + '/contacts/detail/' + (gruppo.contact_id || '')

  const etichettaLink = canale3 ? 'Apri chat WhatsApp' : 'Apri in GHL'
  const classeLink = btnPrimary + ' block w-full text-center'
  const classeIntestazione = rowSub + ' mt-0.5'

  const nMessaggi = gruppo.turni.length
  const parolaMessaggi = nMessaggi === 1 ? 'messaggio' : 'messaggi'
  const nomeCanale = canale3 ? 'Canale 3' : 'GHL'
  const sottotitolo =
    nMessaggi + ' ' + parolaMessaggi + ' · ' + nomeCanale + ' · ' + formatDateTime(gruppo.ultimoAt)

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      <div className="relative z-10 flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-uc-border px-6 py-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-uc-ink">
              {gruppo.nome || shortId(gruppo.contact_id)}
            </p>
            <p className={classeIntestazione}>{sottotitolo}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-uc-muted hover:bg-uc-canvas hover:text-uc-ink">
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-uc-canvas px-4 py-3">
              <p className={sectionLabel}>Identificativo</p>
              <p className="mt-1 break-all font-mono text-xs text-uc-ink">{gruppo.contact_id || '—'}</p>
            </div>
            <div className="rounded-lg bg-uc-canvas px-4 py-3">
              <p className={sectionLabel}>Servizio</p>
              <p className="mt-1 text-xs text-uc-ink">{gruppo.servizio || '—'}</p>
            </div>
          </div>

          {turni.map((t, i) => (
            <TurnoBlocco key={t.id || i} turno={t} indice={i + 1} />
          ))}
        </div>

        <div className="border-t border-uc-border px-6 py-4">
          <a href={hrefLink} target="_blank" rel="noopener noreferrer" className={classeLink}>{etichettaLink}</a>
        </div>
      </div>
    </div>
  )
}

function RigaGruppo({ gruppo, mostraCanale, onSelect }) {
  const g = gruppo
  const classeData = rowSub + ' py-2 pr-3 whitespace-nowrap'
  const classeCanale = rowSub + ' ml-1.5'

  return (
    <tr
      onClick={onSelect}
      className="cursor-pointer border-b border-uc-border/60 transition-colors last:border-0 hover:bg-uc-canvas"
    >
      <td className={classeData}>{formatDateTime(g.ultimoAt)}</td>
      <td className="py-2 pr-3 text-xs text-uc-ink">
        {g.nome ? (
          <span className="font-medium">{g.nome}</span>
        ) : (
          <span className="font-mono">{shortId(g.contact_id)}</span>
        )}
        {mostraCanale ? (
          <span className={classeCanale}>{isCanale3(g.canale) ? '· C3' : '· GHL'}</span>
        ) : null}
      </td>
      <td className="py-2 pr-3 text-xs text-uc-ink">{g.servizio || '—'}</td>
      <td className="py-2 pr-3 text-xs text-uc-muted">{g.turni.length}</td>
      <td className="py-2">
        <span className={pillClass(ESITO_VARIANT[g.esito] || 'neutral')}>{esitoLabel(g.esito)}</span>
      </td>
    </tr>
  )
}

export default function SessionsPanel({ canale = null, title }) {
  const [rows, setRows] = useState([])
  const [nomi, setNomi] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dateFilter, setDateFilter] = useState('')
  const [serviceFilter, setServiceFilter] = useState('')
  const [espanso, setEspanso] = useState(false)
  const [selected, setSelected] = useState(null)

  const load = useCallback(async () => {
    if (!supabase) {
      setError('Supabase non configurato')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    let query = supabase
      .from('session_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(RIGHE_MAX)

    // I record precedenti alla v2.30 non hanno canale: sono tutti GHL.
    if (canale === 'whatsapp_operativo') {
      query = query.eq('canale', 'whatsapp_operativo')
    } else if (canale === 'ghl') {
      query = query.or('canale.eq.whatsapp_inbound,canale.is.null')
    }

    if (dateFilter) {
      const inizio = new Date(dateFilter + 'T00:00:00').toISOString()
      const fine = new Date(dateFilter + 'T23:59:59').toISOString()
      query = query.gte('created_at', inizio).lte('created_at', fine)
    }

    if (serviceFilter) {
      query = query.eq('servizio', serviceFilter)
    }

    const { data, error: fetchError } = await query

    if (fetchError) {
      setError(fetchError.message)
      setLoading(false)
      return
    }

    const righe = data || []
    setRows(righe)
    setLoading(false)

    // Nomi: query separata e non bloccante. Se contacts ha uno schema diverso
    // da quello atteso, restiamo agli id senza rompere nulla.
    const ids = []
    for (const r of righe) {
      if (r.contact_id && ids.indexOf(r.contact_id) === -1) ids.push(r.contact_id)
    }
    if (ids.length === 0) return

    try {
      const { data: contatti, error: errContatti } = await supabase
        .from('contacts')
        .select('*')
        .in('contact_id', ids)

      if (errContatti) return

      const mappa = {}
      for (const c of contatti || []) {
        const nome = estraiNome(c)
        if (nome) mappa[c.contact_id] = nome
      }
      setNomi(mappa)
    } catch {
      /* nomi non disponibili — si mostra l'id */
    }
  }, [canale, dateFilter, serviceFilter])

  useEffect(() => {
    load()
  }, [load])

  const servizi = useMemo(() => {
    const set = new Set()
    for (const r of rows) {
      if (r.servizio) set.add(r.servizio)
    }
    return Array.from(set).sort()
  }, [rows])

  // Raggruppamento: rows arriva gia' in ordine decrescente, quindi la prima
  // occorrenza di ogni contatto e' il suo turno piu' recente e l'ordine di
  // inserimento nella Map e' gia' l'ordine giusto dei gruppi.
  const gruppi = useMemo(() => {
    const mappa = new Map()
    for (const r of rows) {
      const key = r.contact_id || '(senza id)'
      if (!mappa.has(key)) mappa.set(key, [])
      mappa.get(key).push(r)
    }

    const out = []
    for (const [contact_id, turni] of mappa.entries()) {
      const ultimo = turni[0]
      let canaleGruppo = null
      let servizioGruppo = null
      for (const t of turni) {
        if (!canaleGruppo && t.canale) canaleGruppo = t.canale
        if (!servizioGruppo && t.servizio) servizioGruppo = t.servizio
      }
      if (!servizioGruppo) {
        for (const t of turni) {
          if (t.intent) {
            servizioGruppo = t.intent
            break
          }
        }
      }
      out.push({
        contact_id,
        turni,
        nome: nomi[contact_id] || null,
        ultimoAt: ultimo.created_at,
        esito: ultimo.esito,
        canale: canaleGruppo,
        servizio: servizioGruppo,
      })
    }
    return out
  }, [rows, nomi])

  const visibili = espanso ? gruppi : gruppi.slice(0, GRUPPI_DEFAULT)
  const classeInput = inputBase + ' w-auto'
  const etichettaEspandi = espanso
    ? 'Mostra solo i primi ' + GRUPPI_DEFAULT
    : 'Mostra tutti i ' + gruppi.length + ' contatti'

  return (
    <>
      <Card
        label="Sessioni AI"
        title={title || 'Conversazioni per cliente'}
        action={
          <div className="flex flex-wrap gap-2">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className={classeInput}
            />
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className={classeInput}
            >
              <option value="">Tutti i servizi</option>
              {servizi.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        }
      >
        <ErrorBanner message={error} />

        {loading ? (
          <LoadingState />
        ) : gruppi.length === 0 ? (
          <EmptyState message="Nessuna sessione trovata" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-uc-border text-[10px] uppercase tracking-wide text-uc-muted">
                    <th className="pb-2 pr-3 font-medium">Ultimo messaggio</th>
                    <th className="pb-2 pr-3 font-medium">Cliente</th>
                    <th className="pb-2 pr-3 font-medium">Servizio</th>
                    <th className="pb-2 pr-3 font-medium">Turni</th>
                    <th className="pb-2 font-medium">Stato</th>
                  </tr>
                </thead>
                <tbody>
                  {visibili.map((g) => (
                    <RigaGruppo
                      key={g.contact_id}
                      gruppo={g}
                      mostraCanale={!canale}
                      onSelect={() => setSelected(g)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {gruppi.length > GRUPPI_DEFAULT ? (
              <button
                type="button"
                onClick={() => setEspanso(!espanso)}
                className="mt-1 text-xs font-medium text-uc-blue hover:underline"
              >
                {etichettaEspandi}
              </button>
            ) : null}
          </>
        )}
      </Card>

      <ThreadDrawer gruppo={selected} onClose={() => setSelected(null)} />
    </>
  )
}
