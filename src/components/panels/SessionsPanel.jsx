// src/components/panels/SessionsPanel.jsx
// Sessioni AI — raggruppate per contatto
// Versione: 2.0 — 28 luglio 2026
//
// v2.0: una riga per CLIENTE, non per messaggio. Il pannello ora si usa in tre
// contesti diversi tramite la prop `canale`:
//   <SessionsPanel />                          → tutti i canali
//   <SessionsPanel canale="ghl" />             → whatsapp_inbound + record legacy (canale NULL)
//   <SessionsPanel canale="whatsapp_operativo" /> → Canale 3
//
// Lo stato mostrato è `session_logs.esito` per ENTRAMBI i canali (decisione
// del 28 luglio: GHL e Canale 3 uguali). Conseguenza da tenere a mente:
// è l'esito della PIPELINE, non l'azione finale dell'operatore. Una bozza
// Canale 3 già inviata resta "in attesa operatore" qui — l'azione vera si
// legge nel pannello WA Operativo e in Correzioni AI.

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
// Alta perché una conversazione lunga occupa più righe di un contatto.
const RIGHE_MAX = 400
const GRUPPI_DEFAULT = 15

const ESITO_VARIANT = {
  risolto:             'green',
  handoff:             'amber',
  handoff_attivo:      'amber',
  da_approvare:        'blue',
  in_attesa_operatore: 'blue',
  errore:              'red',
}

const ESITO_LABEL = {
  in_attesa_operatore: 'in attesa operatore',
  handoff_attivo:      'handoff attivo',
  da_approvare:        'da approvare',
}

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

// Il nome cliente non vive in session_logs. Lo cerchiamo in `contacts` senza
// dare per scontato il nome della colonna: select('*') non può fallire per
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

function ThreadDrawer({ gruppo, onClose }) {
  if (!gruppo) return null

  const canale3 = isCanale3(gruppo.canale)
  // In ordine cronologico: si legge la conversazione, non il log.
  const turni = [...gruppo.turni].reverse()

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      <div className="relative z-10 flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-uc-border px-6 py-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-uc-ink">
              {gruppo.nome || shortId(gruppo.contact_id)}
            </p>
            <p className={`${rowSub} mt-0.5`}>
              {gruppo.turni.length} messagg{gruppo.turni.length === 1 ? 'io' : 'i'}
              {' · '}
              {canale3 ? 'Canale 3' : 'GHL'}
              {' · '}
              {formatDateTime(gruppo.ultimoAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-uc-muted hover:bg-uc-canvas hover:text-uc-ink"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-uc-canvas px-4 py-3">
              <p className={sectionLabel}>Identificativo</p>
              <p className="mt-1 break-all font-mono text-xs text-uc-ink">
                {gruppo.contact_id || '—'}
              </p>
            </div>
            <div className="rounded-lg bg-uc-canvas px-4 py-3">
              <p className={sectionLabel}>Servizio</p>
              <p className="mt-1 text-xs text-uc-ink">{gruppo.servizio || '—'}</p>
            </div>
          </div>

          {turni.map((t, i) => (
            <div key={t.id ?? i} className="rounded-lg border border-uc-border">
              <div className="flex flex-wrap items-center gap-2 border-b border-uc-border px-3 py-2">
                <span className={sectionLabel}>Turno {i + 1}</span>
                <span className={rowSub}>{formatDateTime(t.created_at)}</span>
                <span className="ml-auto">
                  <span className={pillClass(ESITO_VARIANT[t.esito] ?? 'neutral')}>
                    {esitoLabel(t.esito)}
                  </span>
                </span>
              </div>

              <div className="space-y-3 px-3 py-3">
                {t.testo_cliente && (
                  <div>
                    <p className={sectionLabel}>Cliente</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-uc-ink">
                      {t.testo_cliente}
                    </p>
                  </div>
                )}

                <div>
                  <p className={sectionLabel}>Risposta AI</p>
                  {t.testo_risposta ? (
                    <p className="mt-1 whitespace-pre-wrap rounded-lg bg-[rgba(0,166,61,0.06)] px-3 py-2 text-sm text-uc-ink">
                      {t.testo_risposta}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs italic text-uc-muted">
                      nessuna risposta registrata
                    </p>
                  )}
                </div>

                {Array.isArray(t.citazioni_kb) && t.citazioni_kb.length > 0 && (
                  <div>
                    <p className={sectionLabel}>Citazioni KB ({t.citazioni_kb.length})</p>
                    <div className="mt-1 space-y-1">
                      {t.citazioni_kb.map((c, k) => (
                        <p
                          key={k}
                          className="rounded-lg bg-[rgba(46,111,242,0.06)] px-3 py-1.5 text-xs italic text-uc-ink"
                        >
                          {c}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {t.motivo_handoff && (
                  <div>
                    <p className={sectionLabel}>Motivo handoff</p>
                    <p className="mt-1 rounded-lg bg-[rgba(192,133,50,0.08)] px-3 py-2 text-xs text-uc-amber">
                      {t.motivo_handoff}
                    </p>
                  </div>
                )}

                <p className={rowSub}>
                  {t.agente_dominio || t.agente_destinatario || 'agente non registrato'}
                  {t.esito_qg ? ` · QG: ${t.esito_qg}` : ''}
                  {t.ms_totali ? ` · ${t.ms_totali} ms` : ''}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-uc-border px-6 py-4">
          {canale3 ? (
            
              href={`https://wa.me/${String(gruppo.contact_id || '').replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`${btnPrimary} block w-full text-center`}
            >
              Apri chat WhatsApp →
            </a>
          ) : (
            
              href={`https://app.gohighlevel.com/v2/location/${GHL_LOCATION_ID}/contacts/detail/${gruppo.contact_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`${btnPrimary} block w-full text-center`}
            >
              Apri in GHL →
            </a>
          )}
        </div>
      </div>
    </div>
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

    // I record precedenti alla v2.30 non hanno `canale`: sono tutti GHL.
    if (canale === 'whatsapp_operativo') {
      query = query.eq('canale', 'whatsapp_operativo')
    } else if (canale === 'ghl') {
      query = query.or('canale.eq.whatsapp_inbound,canale.is.null')
    }

    if (dateFilter) {
      query = query
        .gte('created_at', new Date(`${dateFilter}T00:00:00`).toISOString())
        .lte('created_at', new Date(`${dateFilter}T23:59:59`).toISOString())
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

    const righe = data ?? []
    setRows(righe)
    setLoading(false)

    // Nomi: query separata e non bloccante. Se `contacts` ha uno schema
    // diverso da quello che ci aspettiamo, restiamo agli id senza rompere nulla.
    const ids = [...new Set(righe.map((r) => r.contact_id).filter(Boolean))]
    if (ids.length === 0) return

    try {
      const { data: contatti, error: errContatti } = await supabase
        .from('contacts')
        .select('*')
        .in('contact_id', ids)

      if (errContatti) return

      const mappa = {}
      for (const c of contatti ?? []) {
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
    const set = new Set(rows.map((r) => r.servizio).filter(Boolean))
    return [...set].sort()
  }, [rows])

  // Raggruppamento: `rows` arriva già in ordine decrescente, quindi la prima
  // occorrenza di ogni contatto è il suo turno più recente e l'ordine di
  // inserimento nella Map è già l'ordine giusto dei gruppi.
  const gruppi = useMemo(() => {
    const mappa = new Map()
    for (const r of rows) {
      const key = r.contact_id || '(senza id)'
      if (!mappa.has(key)) mappa.set(key, [])
      mappa.get(key).push(r)
    }

    return [...mappa.entries()].map(([contact_id, turni]) => {
      const ultimo = turni[0]
      return {
        contact_id,
        turni,
        nome:      nomi[contact_id] || null,
        ultimoAt:  ultimo.created_at,
        esito:     ultimo.esito,
        canale:    turni.find((t) => t.canale)?.canale || null,
        servizio:  turni.find((t) => t.servizio)?.servizio
                   || turni.find((t) => t.intent)?.intent
                   || null,
      }
    })
  }, [rows, nomi])

  const visibili = espanso ? gruppi : gruppi.slice(0, GRUPPI_DEFAULT)

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
              className={`${inputBase} w-auto`}
            />
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className={`${inputBase} w-auto`}
            >
              <option value="">Tutti i servizi</option>
              {servizi.map((s) => (
                <option key={s} value={s}>{s}</option>
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
                    <tr
                      key={g.contact_id}
                      onClick={() => setSelected(g)}
                      className="cursor-pointer border-b border-uc-border/60 transition-colors last:border-0 hover:bg-uc-canvas"
                    >
                      <td className={`${rowSub} py-2 pr-3 whitespace-nowrap`}>
                        {formatDateTime(g.ultimoAt)}
                      </td>
                      <td className="py-2 pr-3 text-xs text-uc-ink">
                        {g.nome ? (
                          <span className="font-medium">{g.nome}</span>
                        ) : (
                          <span className="font-mono">{shortId(g.contact_id)}</span>
                        )}
                        {!canale && (
                          <span className={`${rowSub} ml-1.5`}>
                            {isCanale3(g.canale) ? '· C3' : '· GHL'}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-xs text-uc-ink">
                        {g.servizio || '—'}
                      </td>
                      <td className="py-2 pr-3 text-xs text-uc-muted">
                        {g.turni.length}
                      </td>
                      <td className="py-2">
                        <span className={pillClass(ESITO_VARIANT[g.esito] ?? 'neutral')}>
                          {esitoLabel(g.esito)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {gruppi.length > GRUPPI_DEFAULT && (
              <button
                type="button"
                onClick={() => setEspanso((v) => !v)}
                className="mt-1 text-xs font-medium text-uc-blue hover:underline"
              >
                {espanso
                  ? `Mostra solo i primi ${GRUPPI_DEFAULT}`
                  : `Mostra tutti i ${gruppi.length} contatti`}
              </button>
            )}
          </>
        )}
      </Card>

      <ThreadDrawer gruppo={selected} onClose={() => setSelected(null)} />
    </>
  )
}
