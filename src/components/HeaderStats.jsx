import { useCallback, useEffect, useState } from 'react'
import { endOfTodayISO, startOfTodayISO, supabase } from '../lib/supabase'
import { Card, ErrorBanner, LoadingState } from './ui'

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-brand-primary">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

export default function HeaderStats() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!supabase) {
      setError('Supabase non configurato')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const start = startOfTodayISO()
    const end = endOfTodayISO()

    try {
      const [sessionsRes, handoffsRes, resolvedRes] = await Promise.all([
        supabase
          .from('session_logs')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', start)
          .lte('created_at', end),
        supabase
          .from('pending_handoffs')
          .select('id', { count: 'exact', head: true })
          .eq('stato', 'aperto'),
        supabase
          .from('session_logs')
          .select('id', { count: 'exact', head: true })
          .eq('esito', 'risolto')
          .gte('created_at', start)
          .lte('created_at', end),
      ])

      if (sessionsRes.error) throw sessionsRes.error
      if (handoffsRes.error) throw handoffsRes.error
      if (resolvedRes.error) throw resolvedRes.error

      const totalMessages = sessionsRes.count ?? 0
      const openHandoffs = handoffsRes.count ?? 0
      const resolvedAutonomously = resolvedRes.count ?? 0
      const denominator = resolvedAutonomously + openHandoffs
      const resolutionRate =
        denominator > 0 ? (resolvedAutonomously / denominator) * 100 : null

      setStats({
        totalMessages,
        openHandoffs,
        resolvedAutonomously,
        resolutionRate,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 60_000)
    return () => clearInterval(interval)
  }, [load])

  const today = new Date().toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-brand-accent">
            UP CAF AI
          </p>
          <h1 className="text-2xl font-bold text-brand-primary">
            Pannello Admin
          </h1>
          <p className="mt-1 text-sm capitalize text-slate-500">{today}</p>
        </div>
        <button
          type="button"
          onClick={load}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-accent hover:text-brand-accent"
        >
          Aggiorna
        </button>
      </div>

      <ErrorBanner message={error} />

      {loading ? (
        <LoadingState />
      ) : stats ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Messaggi totali (oggi)"
            value={stats.totalMessages}
            sub="Sessioni registrate oggi"
          />
          <StatCard
            label="Handoff aperti"
            value={stats.openHandoffs}
            sub="In attesa di operatore"
          />
          <StatCard
            label="Risolti autonomamente"
            value={stats.resolvedAutonomously}
            sub="Esito risolto oggi"
          />
          <StatCard
            label="Tasso risoluzione"
            value={
              stats.resolutionRate != null
                ? `${Math.round(stats.resolutionRate)}%`
                : '—'
            }
            sub="Risolti / (Risolti + Handoff)"
          />
        </div>
      ) : null}
    </div>
  )
}
