import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Card } from './ui'

const FONTE_LABEL = {
  dottrinalavoro_inps: 'INPS',
  dottrinalavoro_fisco: 'Fisco',
  pensionioggi: 'PensioniOggi'
}

const FONTE_COLOR = {
  dottrinalavoro_inps: 'bg-blue-100 text-blue-700',
  dottrinalavoro_fisco: 'bg-amber-100 text-amber-700',
  pensionioggi: 'bg-green-100 text-green-700'
}

export default function NormativePanel() {
  const [atti, setAtti] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchNormative()
  }, [])

  async function fetchNormative() {
    setLoading(true)
    const { data, error } = await supabase
      .from('normative_updates')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) {
      setError(error.message)
    } else {
      setAtti(data || [])
    }
    setLoading(false)
  }

  async function segnaLetto(id) {
    await supabase
      .from('normative_updates')
      .update({ letto: true })
      .eq('id', id)
    setAtti(prev => prev.map(a => a.id === id ? { ...a, letto: true } : a))
  }

  const nuovi = atti.filter(a => !a.letto)
  const letti = atti.filter(a => a.letto)

  const titolo = nuovi.length > 0
    ? 'Novita normative (' + nuovi.length + ' nuove)'
    : 'Novita normative'

  return (
    <Card title={titolo}>
      <div className="mb-4 flex justify-end">
        <button
          onClick={fetchNormative}
          className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200"
        >
          Aggiorna
        </button>
      </div>

      {loading && (
        <p className="py-8 text-center text-sm text-slate-400">Caricamento...</p>
      )}

      {error && (
        <p className="py-8 text-center text-sm text-red-500">Errore: {error}</p>
      )}

      {!loading && !error && atti.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl">
            📋
          </div>
          <p className="text-sm font-medium text-slate-600">Nessun aggiornamento ancora</p>
          <p className="mt-1 max-w-sm text-xs text-slate-400">
            Il polling mattutino rileva le novita automaticamente.
          </p>
        </div>
      )}

      {!loading && !error && atti.length > 0 && (
        <div className="space-y-6">
          {nuovi.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Da leggere
              </p>
              <ul className="space-y-3">
                {nuovi.map(a => (
                  <AttoRow key={a.id} atto={a} onLetto={segnaLetto} letto={false} />
                ))}
              </ul>
            </div>
          )}
          {letti.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
                Gia lette
              </p>
              <ul className="space-y-2">
                {letti.map(a => (
                  <AttoRow key={a.id} atto={a} onLetto={segnaLetto} letto={true} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function AttoRow({ atto, onLetto, letto }) {
  let scheda = null
  try {
    scheda = JSON.parse(atto.scheda_sintetica)
  } catch (e) {
    scheda = null
  }

  const rowClass = letto
    ? 'rounded-lg border p-3 border-slate-100 bg-white opacity-60'
    : 'rounded-lg border p-3 border-slate-200 bg-white shadow-sm'

  const titleClass = letto
    ? 'text-sm font-medium leading-snug text-slate-400'
    : 'text-sm font-medium leading-snug text-slate-800'

  const fonteClass = FONTE_COLOR[atto.fonte] || 'bg-slate-100 text-slate-600'
  const fonteLabel = FONTE_LABEL[atto.fonte] || atto.fonte
  const servizi = atto.servizi_coinvolti || []

  return (
    <li className={rowClass}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            <span className={'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ' + fonteClass}>
              {fonteLabel}
            </span>
            {servizi.map(s => (
              <span key={s} className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
                {s}
              </span>
            ))}
          </div>
          <p className={titleClass}>{atto.titolo}</p>
          {scheda && scheda.sintesi && (
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              {scheda.sintesi}
            </p>
          )}
          <div className="mt-2 flex items-center gap-3">
            <span className="text-xs text-slate-400">{atto.data_pubblicazione}</span>
            {atto.fonte_url && (
              <a
                href={atto.fonte_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-500 hover:underline"
              >
                Leggi originale
              </a>
            )}
          </div>
        </div>
        {!letto && (
          <button
            onClick={() => onLetto(atto.id)}
            className="shrink-0 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-200"
          >
            Segna letto
          </button>
        )}
      </div>
    </li>
  )
}
