import { useState } from 'react'
import { Surface, Tag } from '../components/ui'

// World Ops embeds the standalone OSIRIS OSINT dashboard (separate Next.js app,
// deployed on its own Vercel project). Set VITE_OSIRIS_URL to that deployment's
// origin. OSIRIS must allow framing from this origin (relaxed frame-ancestors).
const OSIRIS_URL = (import.meta.env.VITE_OSIRIS_URL || '').trim()
const OSIRIS_PUBLIC = 'https://osirisai.live'

function NotConfigured() {
  return (
    <div className="biopunk" style={{
      minHeight: '100%', padding: 'clamp(24px, 4vw, 56px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Surface padding={28} style={{ maxWidth: 560, textAlign: 'center' }}>
        <div style={{ fontSize: 34, marginBottom: 10 }}>🌐</div>
        <Tag tone="teal" style={{ marginBottom: 14 }}>World Ops · OSIRIS</Tag>
        <h2 style={{ margin: '0 0 10px', fontSize: 'var(--bp-text-xl)', fontWeight: 700,
          color: 'var(--bp-ink)', letterSpacing: '-0.01em' }}>
          World Ops isn’t connected yet
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: 'var(--bp-text-sm)', lineHeight: 1.65,
          color: 'var(--bp-ink-muted)' }}>
          The live OSINT floor runs as its own deployment. Once OSIRIS is live on
          Vercel, set <code style={{ fontFamily: 'var(--bp-font-mono)', fontSize: 12,
          background: 'var(--bp-surface-3)', padding: '1px 6px', borderRadius: 4 }}>VITE_OSIRIS_URL</code> to
          its URL and this floor lights up — real-time flights, maritime, quakes,
          fires, conflict zones, and the RECON toolkit.
        </p>
        <a className="bp-btn bp-btn--primary" href={OSIRIS_PUBLIC} target="_blank" rel="noreferrer"
          style={{ textDecoration: 'none' }}>
          Open OSIRIS demo ↗
        </a>
      </Surface>
    </div>
  )
}

export default function WorldOpsPage() {
  const [loaded, setLoaded] = useState(false)

  if (!OSIRIS_URL) return <NotConfigured />

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#05070a' }}>
      {!loaded && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 14, zIndex: 1,
          background: 'radial-gradient(80% 60% at 50% 40%, rgba(95,208,216,0.08), transparent 70%), #05070a',
        }}>
          <div className="bp-skeleton" style={{ width: 220, height: 10, borderRadius: 999 }} />
          <div style={{ fontFamily: 'var(--bp-font-mono)', fontSize: 12, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: '#7fe4ea' }}>
            Connecting to World Ops…
          </div>
        </div>
      )}
      <iframe
        src={OSIRIS_URL}
        title="World Ops — OSIRIS intelligence dashboard"
        onLoad={() => setLoaded(true)}
        allow="fullscreen; geolocation; clipboard-read; clipboard-write"
        referrerPolicy="no-referrer"
        style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
      />
    </div>
  )
}
