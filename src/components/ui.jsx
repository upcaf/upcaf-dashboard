export function formatDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatPercent(value) {
  if (value == null || Number.isNaN(value)) return '—'
  return `${Math.round(value)}%`
}

export function urgencyBadgeClass(urgenza) {
  const u = (urgenza || '').toLowerCase()
  if (u.includes('alta') || u.includes('high') || u === 'urgente') {
    return 'bg-red-100 text-red-800 border-red-200'
  }
  if (u.includes('media') || u.includes('medium')) {
    return 'bg-amber-100 text-amber-800 border-amber-200'
  }
  return 'bg-slate-100 text-slate-700 border-slate-200'
}

export function Card({ title, children, className = '', action }) {
  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          {title && (
            <h2 className="text-base font-semibold text-brand-primary">{title}</h2>
          )}
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}

export function EmptyState({ message }) {
  return (
    <p className="py-8 text-center text-sm text-slate-500">{message}</p>
  )
}

export function LoadingState() {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-accent border-t-transparent" />
    </div>
  )
}

export function ErrorBanner({ message }) {
  if (!message) return null
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  )
}
