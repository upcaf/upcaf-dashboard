// src/components/Dashboard.jsx
// v3.0 — 28 luglio 2026: ristrutturazione per canale
//
// (1) NAV — nuovo tab GHL, tab WA Operativo esteso. Ogni canale ha ora la sua
//     vista completa: bozze/approvazioni · handoff · sessioni.
// (2) STATS — QG % corretto. Prima era risolti_OGGI / (risolti_OGGI +
//     handoff_DI_SEMPRE): un handoff aperto a maggio e mai chiuso abbassava
//     per sempre la percentuale di oggi. Ora numeratore e denominatore sono
//     entrambi sulla giornata corrente, letti da session_logs.
// (3) HANDOFF PER CANALE — pending_handoffs.canale è popolato dalla v2.31.
//     I record precedenti hanno canale NULL e vanno letti come GHL.
// (4) CORREZIONI AI — nuovo pannello nel tab WA Operativo.
// (5) Rimossa GATEWAY_URL (puntava al dominio vecchio a488, non usata).
//
// NOTA: src/components/panels/HeaderStats.jsx è orfano da tempo — questo file
// ha la sua HeaderStats locale, alimentata da useDashboardStats(). Quel file
// va cancellato dal repo: contiene query su una colonna (handoff_richiesto)
// che in whatsapp_pending non esiste.

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
import WhatsAppPanel from './panels/WhatsAppPanel'
import CorrectionsPanel from './panels/CorrectionsPanel'
import { btnSecondary } from './ui'

const NAV = [
  { id: 'operativo',  label: 'Operativo',        icon: 'ti-layout-dashboard' },
  { id: 'whatsapp',   label: 'WA Operativo',     icon: 'ti-brand-whatsapp'   },
  { id: 'ghl',        label: 'GHL',              icon: 'ti-address-book'     },
  { id: 'marketing',  label: 'Marketing',        icon: 'ti-speakerphone'     },
  { id: 'normative',  label: 'Normative',        icon: 'ti-news'             },
  { id: 'kb',         label: 'Consulente AI KB', icon: 'ti-database-search'  },
  { id: 'sistema',    label: 'Sistema',          icon: 'ti-activity'         },
]

const SUBTITLES = {
  operativo: 'Panoramica cross-canale',
  whatsapp:  'Numero operativo — Canale 3',
  ghl:       'WhatsApp Meta via GoHighLevel',
  marketing: 'Copy e campagne',
  normative: 'Aggiornamenti normativi',
  kb:        'Consulta la knowledge base',
  sistema:   'Log e stato gateway',
}

function useDashboardStats() {
  const [stats, setStats] = useState({})

  const load = useCallback(async () => {
    if (!supabase) return

    const start = startOfTodayISO()
    const end   = endOfTodayISO()

    // Conteggio senza payload: head:true scarica solo l'header con il totale.
    const conta = (tabella) =>
      supabase.from(tabella).select('id', { count: 'exact', head: true })

    try {
      const [
        sessioniRes,
        risoltiRes,
        handoffOggiRes,
        handoffGhlRes,
        handoffC3Res,
        normativeRes,
        approvalsRes,
        waPendingRes,
      ] = await Promise.all([
        conta('session_logs').gte('created_at', start).lte('created_at', end),

        conta('session_logs')
          .eq('esito', 'risolto')
          .gte('created_at', start)
          .lte('created_at', end),

        // Handoff DI OGGI — serve al denominatore del QG %, non al contatore
        // degli handoff aperti (che è cumulativo per definizione).
        conta('session_logs')
          .eq('esito', 'handoff')
          .gte('created_at', start)
          .lte('created_at', end),

        // canale NULL = record precedenti alla v2.30, tutti GHL.
        conta('pending_handoffs')
          .eq('stato', 'aperto')
          .or('canale.eq.whatsapp_inbound,canale.is.null'),

        conta('pending_handoffs')
          .eq('stato', 'aperto')
          .eq('canale', 'whatsapp_operativo'),

        conta('normative_updates').or('letto.is.null,letto.eq.false'),

        conta('pending_approvals').eq('stato', 'in_attesa'),

        conta('whatsapp_pending').eq('stato', 'in_attesa'),
      ])

      if (sessioniRes.error) throw sessioniRes.error
      if (risoltiRes.error) throw risoltiRes.error

      const risolti      = risoltiRes.count ?? 0
      const handoffOggi  = handoffOggiRes.count ?? 0
      const handoffGhl   = handoffGhlRes.count ?? 0
      const handoffC3    = handoffC3Res.count ?? 0

      // Denominatore onesto e sulla stessa finestra temporale del numeratore:
      // le conversazioni che oggi si sono CHIUSE in un modo o nell'altro.
      const decise = risolti + handoffOggi
      const qgApprovati = decise > 0 ? Math.round((risolti / decise) * 100) : null

      setStats({
        sessioniOggi:    sessioniRes.count ?? 0,
        risoltiOggi:     risolti,
        handoffOggi,
        handoffGhl,
        handoffC3,
        handoffAperti:   handoffGhl + handoffC3,
        qgApprovati,
        novitaNormative: normativeRes.count ?? 0,
        daApprovare:     approvalsRes.count ?? 0,
        waPending:       waPendingRes.count ?? 0,
      })
    } catch {
      /* mantieni i valori precedenti — meglio un dato vecchio di uno vuoto */
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
    day:     'numeric',
    month:   'short',
    year:    'numeric',
  })

  const handoffGhl       = stats.handoffGhl      ?? 0
  const handoffC3        = stats.handoffC3       ?? 0
  const normativeCount   = stats.novitaNormative ?? 0
  const daApprovareCount = stats.daApprovare     ?? 0
  const waPendingCount   = stats.waPending       ?? 0
  const totalAlerts      = handoffGhl + handoffC3 + daApprovareCount + waPendingCount

  const badgeFor = (id) => {
    if (id === 'operativo' && totalAlerts > 0) {
      return { n: totalAlerts, cls: 'bg-uc-amber' }
    }
    if (id === 'whatsapp') {
      const n = waPendingCount + handoffC3
      return n > 0 ? { n, cls: 'bg-green-500' } : null
    }
    if (id === 'ghl') {
      const n = daApprovareCount + handoffGhl
      return n > 0 ? { n, cls: 'bg-uc-blue' } : null
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
          <div className="mt-0.5 text-[10px] text-white/25">Gateway v2.32</div>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-2 py-4" aria-label="Sezioni">
          <div className="mb-1 px-2 text-[9px] font-semibold uppercase tracking-widest text-white/20">
            Menu
          </div>
          {NAV.map(({ id, label, icon }) => {
            const badge    = badgeFor(id)
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
                <span className="truncate">{label}</span>
                {badge && (
                  <span
                    className={`ml-auto shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold text-white ${badge.cls}`}
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
          <span className="text-[10px] text-white/20">v3.0</span>
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
          {active === 'whatsapp'  && <ViewWhatsApp />}
          {active === 'ghl'       && <ViewGHL />}
          {active === 'marketing' && <MarketingPanel />}
          {active === 'normative' && <NormativePanel />}
          {active === 'kb'        && <ViewKB />}
          {active === 'sistema'   && <ViewSistema />}
        </main>
      </div>
    </div>
  )
}

// ─── TAB OPERATIVO — panoramica cross-canale ─────────────────────────────────
function ViewOperativo({ stats }) {
  return (
    <div className="flex flex-col gap-3 p-4 pb-5 sm:px-5">
      <HeaderStats stats={stats} />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ApprovalsPanel />
        <HandoffsPanel title="Handoff aperti — tutti i canali" />
      </div>
      <SessionsPanel title="Conversazioni recenti — tutti i canali" />
      <AccuracyPanel />
    </div>
  )
}

// ─── TAB WA OPERATIVO — Canale 3 ─────────────────────────────────────────────
function ViewWhatsApp() {
  return (
    <div className="flex flex-col gap-3 p-4 pb-5 sm:px-5">
      <WhatsAppPanel />
      <HandoffsPanel
        canale="whatsapp_operativo"
        title="Handoff aperti — Canale 3"
      />
      <SessionsPanel
        canale="whatsapp_operativo"
        title="Conversazioni Canale 3"
      />
      <CorrectionsPanel />
    </div>
  )
}

// ─── TAB GHL — WhatsApp Meta ─────────────────────────────────────────────────
function ViewGHL() {
  return (
    <div className="flex flex-col gap-3 p-4 pb-5 sm:px-5">
      <div className="rounded-xl border border-uc-border bg-white px-4 py-3 text-[11px] text-uc-muted">
        Il workflow GHL è in bozza dal 25 luglio: nessuna risposta automatica
        parte su questo canale. I clienti che scrivono qui vanno gestiti a mano
        in GoHighLevel. Il canale verrà riattivato con la stessa logica di
        approvazione del Canale 3.
      </div>
      <ApprovalsPanel />
      <HandoffsPanel canale="ghl" title="Handoff aperti — GHL" />
      <SessionsPanel canale="ghl" title="Conversazioni GHL" />
    </div>
  )
}

// ─── TAB CONSULENTE AI KB ────────────────────────────────────────────────────
function ViewKB() {
  return (
    <div className="p-4 pb-5 sm:px-5">
      <KbQueryPanel />
    </div>
  )
}

// ─── TAB SISTEMA ─────────────────────────────────────────────────────────────
function ViewSistema() {
  return (
    <div className="grid grid-cols-1 gap-3 p-4 pb-5 sm:px-5 lg:grid-cols-2">
      <ErrorLogsPanel />
      <SystemStatus />
    </div>
  )
}

// ─── HEADER STATS ────────────────────────────────────────────────────────────
function HeaderStats({ stats }) {
  const bozzeWa   = stats.waPending      ?? 0
  const handoff   = stats.handoffAperti  ?? 0
  const normative = stats.novitaNormative ?? 0
  const qg        = stats.qgApprovati

  const items = [
    {
      val:   bozzeWa,
      label: 'Bozze in attesa',
      sub:   'Canale 3 — da approvare',
      color: bozzeWa > 0 ? 'text-red-500' : 'text-uc-ink',
    },
    {
      val:   handoff,
      label: 'Handoff aperti',
      sub:   `${stats.handoffGhl ?? 0} GHL · ${stats.handoffC3 ?? 0} Canale 3`,
      color: handoff > 0 ? 'text-uc-amber' : 'text-uc-ink',
    },
    {
      // null = nessuna conversazione conclusa oggi: "0%" sarebbe una bugia.
      val:   qg == null ? '—' : `${qg}%`,
      label: 'Risolte dall\'AI',
      sub:   qg == null
               ? 'nessuna conversazione conclusa oggi'
               : `${stats.risoltiOggi ?? 0} risolte · ${stats.handoffOggi ?? 0} handoff, oggi`,
      color: 'text-uc-green',
    },
    {
      val:   normative,
      label: 'Novità normative',
      sub:   'Non ancora lette',
      color: normative > 0 ? 'text-uc-blue' : 'text-uc-ink',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4" role="region" aria-label="Riepilogo">
      {items.map(({ val, label, sub, color }) => (
        <div key={label} className="rounded-xl border border-uc-border bg-white p-4">
          <div className={`text-[26px] font-normal tracking-tight ${color}`}>{val}</div>
          <div className="mt-1 text-[10px] font-medium uppercase tracking-wide text-uc-muted">
            {label}
          </div>
          {sub && <div className="mt-0.5 text-[10px] text-uc-muted/60">{sub}</div>}
        </div>
      ))}
    </div>
  )
}
