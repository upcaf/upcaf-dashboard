import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react'
import { endOfTodayISO, startOfTodayISO, supabase } from '../../lib/supabase'
import { ErrorBanner, LoadingState } from '../ui'

function StatCard({ label, value, sub, valueClass = '' }) {
  return (
    <div className="stat">
      <p className={`stat-value${valueClass ? ` ${valueClass}` : ''}`}>{value}</p>
      <p className="stat-label">{label}</p>
      {sub && <p className="stat-sub">{sub}</p>}
    </div>
  )
}

const HeaderStats = forwardRef(function HeaderStats(_props, ref) {
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

  useImperativeHandle(ref, () => ({ refresh: load }), [load])

  useEffect(() => {
    load()
    const interval = setInterval(load, 60_000)
    return () => clearInterval(interval)
  }, [load])

  return (
    <section className="stats-section">
      <ErrorBanner message={error} />

      {loading ? (
        <div className="stats-loading">
          <LoadingState />
        </div>
      ) : stats ? (
        <div className="stats-grid">
          <StatCard
            label="Messaggi totali (oggi)"
            value={stats.totalMessages}
            sub="Sessioni registrate oggi"
          />
          <StatCard
            label="Handoff aperti"
            value={stats.openHandoffs}
            sub="In attesa di operatore"
            valueClass={stats.openHandoffs > 0 ? 'stat-value-amber' : ''}
          />
          <StatCard
            label="Risolti autonomamente"
            value={stats.resolvedAutonomously}
            sub="Esito risolto oggi"
            valueClass="stat-value-green"
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
    </section>
  )
})

export default HeaderStats
