import { useCallback, useEffect, useState } from 'react'
import { checkGatewayHealth } from '../../lib/gateway'
import { checkSupabaseConnection, isSupabaseConfigured } from '../../lib/supabase'
import { btnSecondary, Card, rowSub, rowText } from '../ui'

function StatusRow({ label, status, detail }) {
  const isOk = status === 'ok'
  const isChecking = status === 'checking'

  const dotClass = isChecking
    ? 'bg-uc-muted animate-pulse'
    : isOk
      ? 'bg-uc-green'
      : 'bg-uc-red'

  const statusLabel = isChecking ? 'Verifica…' : isOk ? 'Online' : 'Offline'
  const statusColor = isChecking
    ? 'text-uc-muted'
    : isOk
      ? 'text-uc-green'
      : 'text-uc-red'

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-uc-border bg-uc-canvas p-3">
      <div>
        <p className={`${rowText} font-medium`}>{label}</p>
        {detail && <p className={`${rowSub} mt-1`}>{detail}</p>}
      </div>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dotClass}`} aria-hidden="true" />
        <span className={`text-xs ${statusColor}`}>{statusLabel}</span>
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
      setSupabaseDetail(
        'Variabili VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY mancanti',
      )
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
      label="Sistema"
      title="Stato gateway"
      action={
        <button type="button" onClick={check} className={btnSecondary}>
          Verifica
        </button>
      }
    >
      <div className="flex flex-col gap-2">
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
