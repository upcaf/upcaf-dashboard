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
      const [
        sessionsRes,
        handoffsGhlRes,
        handoffsWaRes,
        resolvedRes,
        bozzeWaRes,
      ] = await Promise.all([
        // Sessioni totali oggi (session_logs — GHL + operatore)
        supabase
          .from('session_logs')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', start)
          .lte('created_at', end),

        // Handoff aperti GHL
        supabase
          .from('pending_handoffs')
          .select('id', { count: 'exact', head: true })
          .eq('stato', 'aperto'),

        // Handoff aperti Canale 3 (whatsapp_pending con handoff_richiesto)
        supabase
          .from('whatsapp_pending')
          .select('id', { count: 'exact', head: true })
          .eq('handoff_richiesto', true)
          .eq('stato', 'in_attesa'),

        // Risolti autonomamente oggi
        supabase
          .from('session_logs')
          .select('id', { count: 'exact', head: true })
          .eq('esito', 'risolto')
          .gte('created_at', start)
          .lte('created_at', end),

        // Bozze Canale 3 in attesa di approvazione
        supabase
          .from('whatsapp_pending')
          .select('id', { count: 'exact', head: true })
          .eq('stato', 'in_attesa')
          .eq('handoff_richiesto', false),
      ])

      if (sessionsRes.error) throw sessionsRes.error
      if (handoffsGhlRes.error) throw handoffsGhlRes.error
      if (handoffsWaRes.error) throw handoffsWaRes.error
      if (resolvedRes.error) throw resolvedRes.error
      if (bozzeWaRes.error) throw bozzeWaRes.error

      const totalMessages     = sessionsRes.count ?? 0
      const openHandoffs      = (handoffsGhlRes.count ?? 0) + (handoffsWaRes.count ?? 0)
      const resolvedAutonomously = resolvedRes.count ?? 0
      const bozzeInAttesa     = bozzeWaRes.count ?? 0

      setStats({
        totalMessages,
        openHandoffs,
        resolvedAutonomously,
        bozzeInAttesa,
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
            sub="GHL + WhatsApp operativo"
            valueClass={stats.openHandoffs > 0 ? 'stat-value-amber' : ''}
          />
          <StatCard
            label="Risolti autonomamente"
            value={stats.resolvedAutonomously}
            sub="Esito risolto oggi"
            valueClass="stat-value-green"
          />
          <StatCard
            label="Bozze in attesa"
            value={stats.bozzeInAttesa}
            sub="WhatsApp — da approvare"
            valueClass={stats.bozzeInAttesa > 0 ? 'stat-value-red' : ''}
          />
        </div>
      ) : null}
    </section>
  )
})

export default HeaderStats
