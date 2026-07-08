import { useState } from 'react'
import { queryKnowledgeBase } from '../lib/gateway'
import { Card, ErrorBanner } from './ui'

export default function KbQueryPanel() {
  const [question, setQuestion] = useState('')
  const [response, setResponse] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!question.trim()) return

    setLoading(true)
    setError(null)
    setResponse(null)

    try {
      const data = await queryKnowledgeBase(question.trim())
      setResponse(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const displayText =
    response?.answer ??
    response?.response ??
    response?.risposta ??
    response?.text ??
    (typeof response === 'string' ? response : null)

  return (
    <Card title="Interroga KB">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="kb-query" className="mb-1.5 block text-sm font-medium text-slate-700">
            Domanda tecnica
          </label>
          <textarea
            id="kb-query"
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Es. Quali documenti servono per il 730 precompilato?"
            className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent/20"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="rounded-lg bg-brand-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? 'Interrogazione in corso…' : 'Interroga (OPERATORE_INTERNO)'}
        </button>
      </form>

      <ErrorBanner message={error} />

      {response && (
        <div className="mt-5 space-y-3">
          {displayText && (
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Risposta
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                {displayText}
              </p>
            </div>
          )}
          <details className="rounded-lg border border-slate-100 bg-white">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-600">
              Risposta JSON completa
            </summary>
            <pre className="overflow-x-auto border-t border-slate-100 p-4 text-xs text-slate-700">
              {JSON.stringify(response, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </Card>
  )
}
