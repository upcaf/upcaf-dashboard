import ErrorLogsPanel from './ErrorLogsPanel'
import HandoffsPanel from './HandoffsPanel'
import HeaderStats from './HeaderStats'
import KbQueryPanel from './KbQueryPanel'
import NormativePanel from './NormativePanel'
import SessionsPanel from './SessionsPanel'
import SystemStatus from './SystemStatus'

export default function Dashboard({ onLogout }) {
  return (
    <div className="min-h-svh">
      <header className="border-b border-slate-200 bg-brand-primary">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-accent text-sm font-bold text-white">
              UP
            </div>
            <span className="text-sm font-semibold text-white">
              UP CAF AI — Admin
            </span>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-lg border border-white/20 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Esci
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <HeaderStats />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <HandoffsPanel />
            <SessionsPanel />
            <KbQueryPanel />
          </div>

          <div className="space-y-6">
            <SystemStatus />
            <NormativePanel />
            <ErrorLogsPanel />
          </div>
        </div>
      </main>
    </div>
  )
}
