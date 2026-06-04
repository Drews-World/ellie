// Biopunk Office — UI kit primitives. Light HZD, single teal accent, ELLIE violet.
// Structural styles inline (codebase idiom); interactive states live in ui.css.
import './ui.css'

// ── Surface: the glass panel everything sits on ──────────────────────────────
export function Surface({
  as: Tag = 'div', interactive = false, glow = false, padding = 18,
  className = '', style = {}, children, ...rest
}) {
  return (
    <Tag
      className={`bp-card ${interactive ? 'bp-card--interactive' : ''} ${className}`.trim()}
      style={{
        background: 'var(--bp-surface)',
        border: '1px solid var(--bp-hairline)',
        borderRadius: 'var(--bp-r-md)',
        boxShadow: glow ? 'var(--bp-shadow-glow)' : 'var(--bp-shadow-md)',
        padding,
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  )
}

// ── Button: pill, variants primary / ellie / ghost / quiet ───────────────────
export function Button({
  variant = 'ghost', size = 'md', className = '', style = {}, children, ...rest
}) {
  const sizes = {
    sm: { fontSize: 12, padding: '6px 14px' },
    md: { fontSize: 13, padding: '9px 18px' },
    lg: { fontSize: 15, padding: '12px 24px' },
  }
  return (
    <button
      className={`bp-btn bp-btn--${variant} ${className}`.trim()}
      style={{ ...sizes[size], ...style }}
      {...rest}
    >
      {children}
    </button>
  )
}

// ── Status model: one source of truth for agent state colors + labels ────────
export const STATUS_META = {
  idle:    { color: 'var(--bp-st-idle)',    label: 'Idle',    pulse: false },
  working: { color: 'var(--bp-st-working)', label: 'Working', pulse: true  },
  waiting: { color: 'var(--bp-st-waiting)', label: 'Waiting', pulse: true  },
  talking: { color: 'var(--bp-st-talking)', label: 'Talking', pulse: true  },
  done:    { color: 'var(--bp-st-done)',    label: 'Done',    pulse: false },
  error:   { color: 'var(--bp-st-error)',   label: 'Error',   pulse: false },
  online:  { color: 'var(--bp-st-done)',    label: 'Online',  pulse: false },
  offline: { color: 'var(--bp-st-idle)',    label: 'Offline', pulse: false },
}

export function StatusDot({ status = 'idle', size = 7 }) {
  const meta = STATUS_META[status] ?? STATUS_META.idle
  return (
    <span
      aria-hidden
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: meta.color,
        boxShadow: meta.pulse ? `0 0 8px ${meta.color}` : 'none',
        animation: meta.pulse ? 'bp-glow-breathe 1.8s ease-in-out infinite' : 'none',
        display: 'inline-block',
      }}
    />
  )
}

export function StatusPill({ status = 'idle', label, style = {} }) {
  const meta = STATUS_META[status] ?? STATUS_META.idle
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '3px 10px 3px 8px',
        borderRadius: 'var(--bp-r-pill)',
        background: 'color-mix(in srgb, ' + meta.color + ' 12%, transparent)',
        border: '1px solid color-mix(in srgb, ' + meta.color + ' 35%, transparent)',
        color: 'var(--bp-ink-2)',
        fontFamily: 'var(--bp-font-mono)',
        fontSize: 'var(--bp-text-2xs)',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        ...style,
      }}
    >
      <StatusDot status={status} size={6} />
      {label ?? meta.label}
    </span>
  )
}

// ── Tag / chip ───────────────────────────────────────────────────────────────
export function Tag({ tone = 'sage', children, style = {} }) {
  const tones = {
    sage:  { fg: 'var(--bp-moss)',        bg: 'rgba(126,139,107,0.14)' },
    teal:  { fg: 'var(--bp-accent-deep)', bg: 'var(--bp-accent-wash)'  },
    amber: { fg: 'var(--bp-amber-deep)',  bg: 'var(--bp-amber-wash)'   },
    ellie: { fg: 'var(--bp-ellie)',       bg: 'var(--bp-ellie-wash)'   },
  }
  const t = tones[tone] ?? tones.sage
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 9px', borderRadius: 'var(--bp-r-pill)',
      background: t.bg, color: t.fg,
      fontFamily: 'var(--bp-font-mono)', fontSize: 'var(--bp-text-2xs)',
      fontWeight: 600, letterSpacing: '0.04em',
      ...style,
    }}>
      {children}
    </span>
  )
}

// ── Section header: title + optional kicker/action (eyebrow used sparingly) ──
export function SectionHeader({ kicker, title, action, style = {} }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
      gap: 16, marginBottom: 16, ...style,
    }}>
      <div>
        {kicker && (
          <div style={{
            fontFamily: 'var(--bp-font-mono)', fontSize: 'var(--bp-text-2xs)',
            letterSpacing: '0.18em', textTransform: 'uppercase',
            color: 'var(--bp-accent-deep)', marginBottom: 6,
          }}>{kicker}</div>
        )}
        <h2 style={{
          fontFamily: 'var(--bp-font-sans)', fontSize: 'var(--bp-text-xl)',
          fontWeight: 600, color: 'var(--bp-ink)', letterSpacing: '-0.01em',
          lineHeight: 1.1, margin: 0,
        }}>{title}</h2>
      </div>
      {action}
    </div>
  )
}
