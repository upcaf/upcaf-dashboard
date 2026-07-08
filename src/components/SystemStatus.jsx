import { useCallback, useEffect, useState } from 'react'
import { checkGatewayHealth } from '../lib/gateway'
import { checkSupabaseConnection, isSupabaseConfigured } from '../lib/supabase'
import { Card } from './ui'

function StatusRow({ label, status, detail }) {
  const isOk = status === 'ok'
  const isChecking = status === 'checking'

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-brand-primary">{label}</p>
        {detail && (
          <p className="mt-0.5 text-xs text-slate-500">{detail}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            isChecking
              ? 'animate-pulse bg-amber-400'
              : isOk
                ? 'bg-emerald-500'
                : 'bg-red-500'
          }`}
        />
        <span
          className={`text-sm font-medium ${
            isChecking
              ? 'text-amber-600'
              : isOk
                ? 'text-emerald-700'
                : 'text-red-700'
          }`}
        >
          {isChecking ? 'Verifica…' : isOk ? 'Online' : 'Offline'}
        </span>
      </div>
    </div>
  )
}

export default function SystemStatus() {
  const [supabaseStatus, setSupabaseStatus] = useState('checking')
  const [supabaseDetail, setSupabaseDetail] = useState('')
  const [gatewayStatus, setGatewayStatus] = useState('checking')
  const [gatewayDetail, setGatewayDetail] = useState('')

  const check = useCallback(async () => {
    setSupabaseStatus('checking')
    setGatewayStatus('checking')

    if (!isSupabaseConfigured()) {
      setSupabaseStatus('error')
      setSupabaseDetail('Variabili VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY mancanti')
    } else {
      const result = await checkSupabaseConnection()
      setSupabaseStatus(result.ok ? 'ok' : 'error')
      setSupabaseDetail(result.ok ? 'Connessione attiva' : result.error)
    }

    const gw = await checkGatewayHealth()
    setGatewayStatus(gw.ok ? 'ok' : 'error')
    setGatewayDetail(
      gw.ok
        ? `Gateway operativo${gw.data?.ts ? ` — ${new Date(gw.data.ts).toLocaleTimeString('it-IT')}` : ''}`
        : gw.error,
    )
  }, [])

  useEffect(() => {
    check()
    const interval = setInterval(check, 30_000)
    return () => clearInterval(interval)
  }, [check])

  return (
    <Card
      title="Stato sistema"
      action={
        <button
          type="button"
          onClick={check}
          className="text-sm font-medium text-brand-accent hover:underline"
        >
          Verifica
        </button>
      }
    >
      <div className="space-y-3">
        <StatusRow
          label="Supabase"
          status={supabaseStatus}
          detail={supabaseDetail}
        />
        <StatusRow
          label="Gateway Railway"
          status={gatewayStatus}
          detail={gatewayDetail}
        />
      </div>
    </Card>
  )
}
