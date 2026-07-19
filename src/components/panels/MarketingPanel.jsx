import { useState } from 'react'
import {
  btnPrimary,
  Card,
  ErrorBanner,
  inputBase,
  rowText,
  sectionLabel,
} from '../ui'

const GATEWAY_URL =
  import.meta.env.VITE_GATEWAY_URL ||
  'https://gateway-production-a488.up.railway.app'

const CANALI = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email testo' },
]

const SERVIZI = ['730', 'ISEE', 'NASPi', 'Pensioni', 'Successioni', 'Generico']

async function postGateway(path, body) {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || data.message || `Errore gateway (${res.status})`)
  }
  return data
}

function extractText(data) {
  return (
    data.copy ??
    data.testo ??
    data.contenuto ??
    data.risposta ??
    data.html ??
    JSON.stringify(data, null, 2)
  )
}

export default function MarketingPanel() {
  const [tema, setTema] = useState('')
  const [canale, setCanale] = useState('whatsapp')
  const [servizio, setServizio] = useState('Generico')
  const [oggetto, setOggetto] = useState('')
  const [copyResult, setCopyResult] = useState('')
  const [htmlResult, setHtmlResult] = useState('')
  const [loadingCopy, setLoadingCopy] = useState(false)
  const [loadingHtml, setLoadingHtml] = useState(false)
  const [error, setError] = useState(null)

  async function handleGeneraMarketing() {
    if (!tema.trim()) return
    setLoadingCopy(true)
    setError(null)
    setCopyResult('')

    try {
      const data = await postGateway('/genera-marketing', {
        tema: tema.trim(),
        canale,
        servizio,
      })
      setCopyResult(extractText(data))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingCopy(false)
    }
  }

  async function handleGeneraHtmlEmail() {
    if (!tema.trim()) return
    setLoadingHtml(true)
    setError(null)
    setHtmlResult('')

    try {
      const data = await postGateway('/genera-html-email', {
        tema: tema.trim(),
        servizio,
        oggetto: oggetto.trim() || undefined,
      })
      setHtmlResult(extractText(data))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingHtml(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-3 p-4 pb-5 sm:px-5 lg:grid-cols-2">
      <Card label="Marketing" title="Copy WA / email">
        <div className="flex flex-col gap-3">
          <div>
            <label htmlFor="mkt-tema" className={`${sectionLabel} mb-1.5 block`}>
              Tema / brief
            </label>
            <textarea
              id="mkt-tema"
              className={`${inputBase} min-h-20 resize-y`}
              rows={3}
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              placeholder="Es. Promemoria scadenza 730 precompilato"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="mkt-canale" className={`${sectionLabel} mb-1.5 block`}>
                Canale
              </label>
              <select
                id="mkt-canale"
                className={inputBase}
                value={canale}
                onChange={(e) => setCanale(e.target.value)}
              >
                {CANALI.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="mkt-servizio" className={`${sectionLabel} mb-1.5 block`}>
                Servizio
              </label>
              <select
                id="mkt-servizio"
                className={inputBase}
                value={servizio}
                onChange={(e) => setServizio(e.target.value)}
              >
                {SERVIZI.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            className={`${btnPrimary} self-start`}
            onClick={handleGeneraMarketing}
            disabled={loadingCopy || !tema.trim()}
          >
            {loadingCopy ? 'Generazione…' : 'Genera copy'}
          </button>

          {copyResult && (
            <div>
              <p className={`${sectionLabel} mb-1.5`}>Risultato</p>
              <textarea
                className={`${inputBase} min-h-32 resize-y font-normal`}
                value={copyResult}
                onChange={(e) => setCopyResult(e.target.value)}
              />
            </div>
          )}
        </div>
      </Card>

      <Card label="Email HTML" title="Template GHL">
        <div className="flex flex-col gap-3">
          <div>
            <label htmlFor="mkt-oggetto" className={`${sectionLabel} mb-1.5 block`}>
              Oggetto email (opzionale)
            </label>
            <input
              id="mkt-oggetto"
              className={inputBase}
              type="text"
              value={oggetto}
              onChange={(e) => setOggetto(e.target.value)}
              placeholder="Es. Novità UP CAF — scadenze luglio"
            />
          </div>

          <p className={rowText}>
            Usa lo stesso tema del pannello copy. Servizio:{' '}
            <span className="font-medium">{servizio}</span>
          </p>

          <button
            type="button"
            className={`${btnPrimary} self-start`}
            onClick={handleGeneraHtmlEmail}
            disabled={loadingHtml || !tema.trim()}
          >
            {loadingHtml ? 'Generazione…' : 'Genera HTML email'}
          </button>

          {htmlResult && (
            <div>
              <p className={`${sectionLabel} mb-1.5`}>HTML generato</p>
              <textarea
                className={`${inputBase} min-h-48 resize-y font-mono text-[11px]`}
                value={htmlResult}
                onChange={(e) => setHtmlResult(e.target.value)}
              />
            </div>
          )}
        </div>
      </Card>

      <div className="lg:col-span-2">
        <ErrorBanner message={error} />
      </div>
    </div>
  )
}
