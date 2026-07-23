import { useCallback, useEffect, useState } from 'react'
import { endOfTodayISO, startOfTodayISO, supabase } from '../lib/supabase'
import HandoffsPanel from './panels/HandoffsPanel'
import SessionsPanel from './panels/SessionsPanel'
import KbQueryPanel from './panels/KbQueryPanel'
import MarketingPanel from './panels/MarketingPanel'
import NormativePanel from './panels/NormativePanel'
import ErrorLogsPanel from './panels/ErrorLogsPanel'
import SystemStatus from './panels/SystemStatus'
import AccuracyPanel from './panels/AccuracyPanel'
import ApprovalsPanel from './panels/ApprovalsPanel'
import { btnSecondary } from './ui'

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'https://gateway-production-a488.up.railway.app'

const NAV = [
  { id: 'operativo', label: 'Operativo', icon: 'ti-layout-dashboard' },
  { id: 'marketing', label: 'Marketing', icon: 'ti-speakerphone' },
  { id: 'normative', label: 'Normative', icon: 'ti-news' },
  { id: 'sistema', label: 'Sistema', icon: 'ti-activity' },
]

const SUBTITLES = {
  operativo: 'Panoramica sessione',
  marketing: 'Copy e campagne',
  normative: 'Aggiornamenti normativi',
  sistema: 'Log e stato gateway',
}

function useDashboardStats() {
  const [stats, setStats] = useState({})

  const load = useCallback(async () => {
    if (!supabase) return

    const start = startOfTodayISO()
    const end = endOfTodayISO()

    try {
      const [sessionsRes, handoffsRes, resolvedRes, normativeRes, approvalsRes] =
        await Promise.all([
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
          supabase
            .from('normative_updates')
            .select('id', { count: 'exact', head: true })
            .or('letto.is.null,letto.eq.false'),
          supabase
            .from('pending_approvals')
            .select('id', { count: 'exact', head: true })
            .eq('stato', 'in_attesa'),
        ])

      if (sessionsRes.error) throw sessionsRes.error
      if (handoffsRes.error) throw handoffsRes.error
      if (resolvedRes.error) throw resolvedRes.error
      if (normativeRes.error) throw normativeRes.error

      const openHandoffs = handoffsRes.count ?? 0
      const resolvedAutonomously = resolvedRes.count ?? 0
      const denominator = resolvedAutonomously + openHandoffs
      const qgApprovati =
        denominator > 0
          ? Math.round((resolvedAutonomously / denominator) * 100)
          : 0

      setStats({
        handoffAperti: openHandoffs,
        sessioniOggi: sessionsRes.count ?? 0,
        qgApprovati,
        novitaNormative: normativeRes.count ?? 0,
        daApprovare: approvalsRes.count ?? 0,
      })
    } catch {
      /* mantieni valori precedenti */
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
  }, [load])

  return stats
}

export default function Dashboard({ onLogout }) {
  const [active, setActive] = useState('operativo')
  const stats = useDashboardStats()

  const today = new Date().toLocaleDateString('it-IT', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  const handoffCount = stats.handoffAperti ?? 0
  const normativeCount = stats.novitaNormative ?? 0
  const daApprovareCount = stats.daApprovare ?? 0
  const totalAlerts = handoffCount + daApprovareCount

  const badgeFor = (id) => {
    if (id === 'operativo' && totalAlerts > 0) {
      return { n: totalAlerts, cls: daApprovareCount > 0 ? 'bg-blue-500' : 'bg-uc-amber' }
    }
    if (id === 'normative' && normativeCount > 0) {
      return { n: normativeCount, cls: 'bg-uc-blue' }
    }
    return null
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-uc-canvas font-sans text-uc-ink">
      <aside
        className="flex w-[200px] min-w-[200px] shrink-0 flex-col border-r border-white/[0.07] bg-uc-sidebar"
        aria-label="Navigazione principale"
      >
        <div className="border-b border-white/[0.07] px-4 pb-4 pt-[18px]">
          <div className="text-[15px] font-semibold tracking-tight text-[#f5f5f7]">
            UP CAF <span className="text-uc-blue">AI</span>
          </div>
          <div className="mt-0.5 text-[10px] text-white/25">Gateway v2.23</div>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-2 py-4" aria-label="Sezioni">
          <div className="mb-1 px-2 text-[9px] font-semibold uppercase tracking-widest text-white/20">
            Menu
          </div>
          {NAV.map(({ id, label, icon }) => {
            const badge = badgeFor(id)
            const isActive = active === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActive(id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] transition ${
                  isActive
                    ? 'bg-white/[0.09] font-medium text-[#f5f5f7]'
                    : 'font-normal text-white/40 hover:bg-white/[0.05] hover:text-white/60'
                }`}
              >
                <i className={`ti ${icon} text-[15px]`} aria-hidden="true" />
                <span>{label}</span>
                {badge && (
                  <span
                    className={`ml-auto rounded-full px-1.5 py-px text-[10px] font-semibold text-white ${badge.cls}`}
                  >
                    {badge.n}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        <div className="flex items-center justify-between border-t border-white/[0.07] px-4 py-3">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-uc-green" aria-hidden="true" />
            <span className="text-[10px] font-medium text-uc-green">Live</span>
          </div>
          <span className="text-[10px] text-white/20">v2.23</span>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[46px] shrink-0 items-center justify-between border-b border-uc-border bg-white px-5">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold tracking-tight text-uc-ink">
              {NAV.find((n) => n.id === active)?.label}
            </h1>
            <span className="text-uc-border" aria-hidden="true">·</span>
            <span className="text-xs text-uc-muted">{SUBTITLES[active]}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-uc-muted">{today}</span>
            <button
              type="button"
              className="relative flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-uc-border bg-white text-uc-muted transition hover:bg-uc-canvas"
              aria-label={`${totalAlerts} notifiche`}
            >
              <i className="ti ti-bell text-[15px]" aria-hidden="true" />
              {totalAlerts > 0 && (
                <span
                  className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full border border-white bg-uc-amber"
                  aria-hidden="true"
                />
              )}
            </button>
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-uc-blue text-[11px] font-semibold text-white"
              aria-label="Operatore UP CAF"
            >
              U
            </div>
            {onLogout && (
              <button type="button" className={btnSecondary} onClick={onLogout}>
                Esci
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto" aria-label={`Sezione ${active}`}>
          {active === 'operativo' && <ViewOperativo stats={stats} />}
          {active === 'marketing' && <MarketingPanel />}
          {active === 'normative' && <NormativePanel />}
          {active === 'sistema' && <ViewSistema />}
        </main>
      </div>
    </div>
  )
}

function ViewOperativo({ stats }) {
  return (
    <div className="flex flex-col gap-3 p-4 pb-5 sm:px-5">
      <HeaderStats stats={stats} />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <HandoffsPanel />
        <SessionsPanel />
        {/* Gamba 3 — approvazioni DA_APPROVARE */}
        <div className="lg:col-span-2">
          <ApprovalsPanel />
        </div>
        {/* Gamba 1 — metrica accuratezza */}
        <div className="lg:col-span-2">
          <AccuracyPanel />
        </div>
        <div className="lg:col-span-2">
          <KbQueryPanel />
        </div>
      </div>
    </div>
  )
}

function ViewSistema() {
  return (
    <div className="grid grid-cols-1 gap-3 p-4 pb-5 sm:px-5 lg:grid-cols-2">
      <ErrorLogsPanel />
      <SystemStatus />
    </div>
  )
}

function HeaderStats({ stats }) {
  const items = [
    { val: stats.handoffAperti ?? 0, label: 'Handoff aperti', color: 'text-uc-amber' },
    { val: stats.daApprovare ?? 0, label: 'Da approvare', color: 'text-blue-600' },
    { val: `${stats.qgApprovati ?? 0}%`, label: 'QG approvati', color: 'text-uc-green' },
    { val: stats.novitaNormative ?? 0, label: 'Novità normative', color: 'text-uc-ink' },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4" role="region" aria-label="Riepilogo">
      {items.map(({ val, label, color }) => (
        <div key={label} className="rounded-xl border border-uc-border bg-white p-4">
          <div className={`text-[26px] font-normal tracking-tight ${color}`}>{val}</div>
          <div className="mt-1 text-[10px] font-medium uppercase tracking-wide text-uc-muted">{label}</div>
        </div>
      ))}
    </div>
  )
}
