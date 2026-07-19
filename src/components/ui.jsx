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

export const sectionLabel =
  'text-[10px] font-medium uppercase tracking-wider text-uc-muted'

export const rowText = 'text-xs text-uc-ink'

export const rowSub = 'text-[10px] text-uc-muted'

export const btnPrimary =
  'rounded-lg bg-uc-ink px-3 py-1.5 text-xs font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-45'

export const btnSecondary =
  'rounded-lg border border-uc-border bg-white px-3 py-1.5 text-xs font-medium text-uc-ink transition hover:bg-uc-canvas disabled:cursor-not-allowed disabled:opacity-45'

export const inputBase =
  'w-full rounded-lg border border-uc-border bg-uc-canvas px-3 py-2 text-xs text-uc-ink outline-none transition placeholder:text-uc-muted focus:border-uc-blue'

export function pillClass(variant = 'neutral') {
  const base = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium'
  const variants = {
    neutral: `${base} border border-uc-border bg-uc-canvas text-uc-muted`,
    blue: `${base} bg-[rgba(46,111,242,0.08)] text-[#1a55c4]`,
    amber: `${base} bg-[rgba(192,133,50,0.1)] text-uc-amber`,
    green: `${base} bg-[rgba(0,166,61,0.08)] text-uc-green`,
    red: `${base} bg-[rgba(181,32,64,0.08)] text-uc-red`,
  }
  return variants[variant] ?? variants.neutral
}

export function urgencyBadgeClass(urgenza) {
  const u = (urgenza || '').toLowerCase()
  if (u.includes('alta') || u.includes('high') || u === 'urgente') {
    return pillClass('red')
  }
  if (u.includes('media') || u.includes('medium')) {
    return pillClass('amber')
  }
  return pillClass('neutral')
}

export function Card({ title, children, className = '', action, label }) {
  return (
    <section
      className={`flex flex-col gap-3 rounded-xl border border-uc-border bg-white p-4 ${className}`}
    >
      {(label || title || action) && (
        <header className="flex items-start justify-between gap-3">
          <div>
            {label && <p className={sectionLabel}>{label}</p>}
            {title && (
              <h2 className={`${rowText} font-medium ${label ? 'mt-1' : ''}`}>
                {title}
              </h2>
            )}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function ItemRow({ children, muted = false, className = '' }) {
  return (
    <article
      className={`rounded-lg border border-uc-border bg-uc-canvas p-3 ${
        muted ? 'opacity-60' : ''
      } ${className}`}
    >
      {children}
    </article>
  )
}

export function EmptyState({ message }) {
  return (
    <p className="py-8 text-center text-xs text-uc-muted">{message}</p>
  )
}

export function LoadingState() {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-uc-blue border-t-transparent" />
    </div>
  )
}

export function ErrorBanner({ message }) {
  if (!message) return null
  return (
    <div
      className={`${pillClass('red')} block px-3 py-2 text-xs`}
      role="alert"
    >
      {message}
    </div>
  )
}

export function CaptionBox({ value, onChange, label = 'Caption post' }) {
  return (
    <div className="mt-3 border-t border-uc-border pt-3">
      <p className={`${sectionLabel} mb-2`}>{label}</p>
      <textarea
        className={`${inputBase} min-h-24 resize-y`}
        rows={4}
        value={value}
        onChange={onChange}
      />
    </div>
  )
}
