import { Card } from './ui'

export default function NormativePanel() {
  return (
    <Card title="Novità normative">
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl">
          📋
        </div>
        <p className="text-sm font-medium text-slate-600">
          Normative Polling non ancora attivo
        </p>
        <p className="mt-1 max-w-sm text-xs text-slate-400">
          Questa sezione mostrerà gli aggiornamenti normativi rilevati
          automaticamente dal sistema.
        </p>
      </div>
    </Card>
  )
}
