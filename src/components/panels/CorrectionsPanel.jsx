// src/components/panels/CorrectionsPanel.jsx
// Correzioni AI — confronto tra la bozza generata e il testo realmente inviato
// Versione: 1.0 — 28 luglio 2026
//
// Legge GET /wa/corrections (gateway v2.32), che espone i record
// whatsapp_pending in stato modificato_e_inviato.
//
// A cosa serve: è il corpus su cui si rivedono i prompt. Non è una metrica di
// qualità — una correzione non è un errore dell'AI, spesso è un operatore che
// sa qualcosa che la KB non contiene. Il segnale utile è la RICORRENZA di un
// motivo: dieci "promessa_impossibile" in due settimane dicono che il Prompt 9
// promette cose che il sistema non può mantenere, e quello si corregge a monte.

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Card,
  EmptyState,
  ErrorBanner,
  formatDateTime,
  ItemRow,
  LoadingState,
  rowSub,
  sectionLabel,
} from '../ui'

const CANALE3_URL = 'https://gateway-production-4696.up.railway.app'

// Tassonomia applicativa — nessun check constraint a DB, per poterla
// aggiustare senza migrazioni (vedi schema whatsapp_pending).
const MOTIVI = {
  dato_superato: {
    label: 'Dato superato',
    hint: 'La KB era vecchia',
    tone: 'amber',
  },
  dato_sbagliato: {
    label: 'Dato sbagliato',
    hint: 'Numero errato — il caso più grave',
    tone: 'red',
  },
  mancava_info: {
    label: 'Mancava info',
    hint: 'Risposta incompleta',
    tone: 'amber',
  },
  troppo_lungo: {
    label: 'Troppo lungo',
    hint: 'Vincolo stile WhatsApp',
    tone: 'slate',
  },
  tono: {
    label: 'Tono',
    hint: 'Forma, non contenuto',
    tone: 'slate',
  },
  promessa_impossibile: {
    label: 'Promessa impossibile',
    hint: 'Il sistema non può onorarla',
    tone: 'red',
  },
}

const TONE_CLASS = {
  red: 'bg-red-50 text-red-800 border-red-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  slate: 'bg-slate-50 text-slate-700 border-slate-200',
}

function motivoMeta(key) {
  return MOTIVI[key] || { label: key || 'non classificato', hint: null, tone: 'slate' }
}

function MotivoBadge({ motivo }) {
  const meta = motivoMeta(motivo)
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${TONE_CLASS[meta.tone]}`}
    >
      {meta.label}
    </span>
  )
}

function CorrectionCard({ item }) {
  const [aperto, setAperto] = useState(false)

  return (
    <ItemRow>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-uc-ink">
          {item.nome_cliente || 'nome non noto'}
        </span>
        <span className="text-xs text-uc-muted">·</span>
        <span className="font-mono text-xs text-uc-muted">{item.numero || '—'}</span>
        <MotivoBadge motivo={item.motivo_correzione} />
        <span className={`${rowSub} ml-auto`}>{formatDateTime(item.created_at)}</span>
      </div>

      {item.messaggio_ricevuto && (
        <button
          type="button"
          onClick={() => setAperto((v) => !v)}
          className="mb-2 block w-full rounded-lg border border-uc-border bg-uc-canvas px-3 py-2 text-left"
        >
          <span className={sectionLabel}>Domanda del cliente</span>
          <p
            className={`mt-1 text-xs text-uc-ink ${aperto ? 'whitespace-pre-wrap' : 'truncate'}`}
          >
            {item.messaggio_ricevuto}
          </p>
        </button>
      )}

      <div className="grid gap-2 md:grid-cols-2">
        <div className="rounded-lg border border-uc-border bg-uc-canvas px-3 py-2">
          <p className={sectionLabel}>Bozza AI</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-uc-muted">
            {item.risposta_ai || <span className="italic">nessuna bozza</span>}
          </p>
        </div>
        <div className="rounded-lg border border-uc-border bg-[rgba(0,166,61,0.06)] px-3 py-2">
          <p className={sectionLabel}>Inviato dall'operatore</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-uc-ink">
            {item.testo_finale_inviato || <span className="italic">—</span>}
          </p>
        </div>
      </div>
    </ItemRow>
  )
}

export default function CorrectionsPanel() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filtro, setFiltro] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${CANALE3_URL}/wa/corrections?limit=200`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setItems(Array.isArray(data.corrections) ? data.corrections : [])
    } catch (err) {
      setError('Gateway non raggiungibile o errore lettura: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Conteggio per motivo — è il dato che conta davvero, la lista è il dettaglio.
  const conteggi = useMemo(() => {
    const mappa = new Map()
    for (const it of items) {
      const k = it.motivo_correzione || 'non_classificato'
      mappa.set(k, (mappa.get(k) || 0) + 1)
    }
    return [...mappa.entries()].sort((a, b) => b[1] - a[1])
  }, [items])

  const visibili = useMemo(() => {
    if (!filtro) return items
    return items.filter(
      (it) => (it.motivo_correzione || 'non_classificato') === filtro
    )
  }, [items, filtro])

  return (
    <Card
      label="Correzioni AI"
      title={`Bozza generata vs testo inviato${items.length ? ` (${items.length})` : ''}`}
      action={
        <button
          type="button"
          onClick={load}
          className="rounded-lg border border-uc-border px-3 py-1.5 text-sm hover:bg-uc-canvas"
        >
          Aggiorna
        </button>
      }
    >
      <ErrorBanner message={error} />

      {loading ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState message="Nessuna correzione registrata — le bozze inviate intatte non compaiono qui" />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFiltro(null)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                filtro === null
                  ? 'border-uc-ink bg-uc-ink text-white'
                  : 'border-uc-border text-uc-muted hover:bg-uc-canvas'
              }`}
            >
              Tutte · {items.length}
            </button>
            {conteggi.map(([key, n]) => {
              const meta = motivoMeta(key)
              const attivo = filtro === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFiltro(attivo ? null : key)}
                  title={meta.hint || undefined}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    attivo
                      ? 'border-uc-ink bg-uc-ink text-white'
                      : TONE_CLASS[meta.tone] + ' hover:opacity-80'
                  }`}
                >
                  {meta.label} · {n}
                </button>
              )
            })}
          </div>

          <p className={`${rowSub} mb-3`}>
            Una correzione non è un errore dell'AI: spesso l'operatore sa qualcosa
            che la KB non contiene. Il segnale da leggere è quale motivo si ripete.
          </p>

          <div className="flex flex-col gap-2">
            {visibili.map((item) => (
              <CorrectionCard key={item.id} item={item} />
            ))}
          </div>
        </>
      )}
    </Card>
  )
}
