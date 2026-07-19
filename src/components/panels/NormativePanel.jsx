import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  btnPrimary,
  btnSecondary,
  CaptionBox,
  Card,
  EmptyState,
  ErrorBanner,
  ItemRow,
  LoadingState,
  pillClass,
  rowSub,
  rowText,
  sectionLabel,
} from '../ui'

const GATEWAY_URL =
  import.meta.env.VITE_GATEWAY_URL ||
  'https://gateway-production-a488.up.railway.app'

const FONTE_LABEL = {
  dottrinalavoro_inps: 'INPS',
  dottrinalavoro_fisco: 'Fisco',
  pensionioggi: 'PensioniOggi',
}

const FONTE_PILL = {
  dottrinalavoro_inps: 'blue',
  dottrinalavoro_fisco: 'amber',
  pensionioggi: 'green',
}

export default function NormativePanel() {
  const [atti, setAtti] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [captions, setCaptions] = useState({})
  const [generatingId, setGeneratingId] = useState(null)
  const [postError, setPostError] = useState(null)

  useEffect(() => {
    fetchNormative()
  }, [])

  async function fetchNormative() {
    if (!supabase) {
      setError('Supabase non configurato')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('normative_updates')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setAtti(data || [])
    }
    setLoading(false)
  }

  async function segnaLetto(id) {
    if (!supabase) return
    await supabase
      .from('normative_updates')
      .update({ letto: true })
      .eq('id', id)
    setAtti((prev) =>
      prev.map((a) => (a.id === id ? { ...a, letto: true } : a)),
    )
  }

  async function generaPost(atto) {
    setGeneratingId(atto.id)
    setPostError(null)

    try {
      const res = await fetch(`${GATEWAY_URL}/genera-post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: atto.id,
          titolo: atto.titolo,
          fonte: atto.fonte,
          scheda_sintetica: atto.scheda_sintetica,
          servizi_coinvolti: atto.servizi_coinvolti,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(
          data.error || data.message || `Errore gateway (${res.status})`,
        )
      }
      const caption =
        data.caption ??
        data.post ??
        data.testo ??
        data.contenuto ??
        JSON.stringify(data, null, 2)
      setCaptions((prev) => ({ ...prev, [atto.id]: caption }))
    } catch (e) {
      setPostError(e.message || 'Errore generazione post.')
    } finally {
      setGeneratingId(null)
    }
  }

  const nuovi = atti.filter((a) => !a.letto)
  const letti = atti.filter((a) => a.letto)

  return (
    <div className="flex flex-col gap-3 p-4 pb-5 sm:px-5">
      <Card
        label="Normative"
        title={
          nuovi.length > 0
            ? `Novità normative (${nuovi.length} nuove)`
            : 'Novità normative'
        }
        action={
          <button
            type="button"
            onClick={fetchNormative}
            className={btnSecondary}
          >
            Aggiorna
          </button>
        }
      >
        <ErrorBanner message={error} />
        <ErrorBanner message={postError} />

        {loading ? (
          <LoadingState />
        ) : atti.length === 0 && !error ? (
          <EmptyState message="Nessun aggiornamento ancora" />
        ) : (
          <div className="flex flex-col gap-5">
            {nuovi.length > 0 && (
              <section>
                <p className={`${sectionLabel} mb-2`}>Da leggere</p>
                <ul className="flex flex-col gap-2">
                  {nuovi.map((a) => (
                    <AttoRow
                      key={a.id}
                      atto={a}
                      onLetto={segnaLetto}
                      onGeneraPost={generaPost}
                      generating={generatingId === a.id}
                      caption={captions[a.id]}
                      onCaptionChange={(value) =>
                        setCaptions((prev) => ({ ...prev, [a.id]: value }))
                      }
                    />
                  ))}
                </ul>
              </section>
            )}
            {letti.length > 0 && (
              <section>
                <p className={`${sectionLabel} mb-2`}>Già lette</p>
                <ul className="flex flex-col gap-2">
                  {letti.map((a) => (
                    <AttoRow
                      key={a.id}
                      atto={a}
                      onLetto={segnaLetto}
                      onGeneraPost={generaPost}
                      generating={generatingId === a.id}
                      caption={captions[a.id]}
                      onCaptionChange={(value) =>
                        setCaptions((prev) => ({ ...prev, [a.id]: value }))
                      }
                      letto
                    />
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}

function AttoRow({
  atto,
  onLetto,
  onGeneraPost,
  generating,
  caption,
  onCaptionChange,
  letto = false,
}) {
  let scheda = null
  try {
    scheda = JSON.parse(atto.scheda_sintetica)
  } catch {
    scheda = null
  }

  const fonteVariant = FONTE_PILL[atto.fonte] || 'neutral'
  const fonteLabel = FONTE_LABEL[atto.fonte] || atto.fonte
  const servizi = atto.servizi_coinvolti || []

  return (
    <li>
      <ItemRow muted={letto}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap gap-1.5">
              <span className={pillClass(fonteVariant)}>{fonteLabel}</span>
              {servizi.map((s) => (
                <span key={s} className={pillClass('blue')}>
                  {s}
                </span>
              ))}
            </div>
            <p className={`${rowText} font-medium`}>{atto.titolo}</p>
            {scheda?.sintesi && (
              <p className={`${rowSub} mt-1 leading-relaxed`}>
                {scheda.sintesi}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className={rowSub}>{atto.data_pubblicazione}</span>
              {atto.fonte_url && (
                <a
                  href={atto.fonte_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-uc-blue hover:underline"
                >
                  Leggi originale
                </a>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <button
              type="button"
              onClick={() => onGeneraPost(atto)}
              disabled={generating}
              className={btnPrimary}
            >
              {generating ? 'Generazione…' : 'Genera post'}
            </button>
            {!letto && (
              <button
                type="button"
                onClick={() => onLetto(atto.id)}
                className={btnSecondary}
              >
                Segna letto
              </button>
            )}
          </div>
        </div>

        {caption != null && (
          <CaptionBox
            value={caption}
            onChange={(e) => onCaptionChange(e.target.value)}
          />
        )}
      </ItemRow>
    </li>
  )
}
