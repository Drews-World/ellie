import { Surface, Tag } from '../components/ui'

// World Ops links out to the standalone OSIRIS OSINT dashboard. OSIRIS blocks
// cross-origin framing (X-Frame-Options: SAMEORIGIN), so we open it in a new
// tab rather than embedding. Override the target with VITE_OSIRIS_URL if you
// ever stand up your own framing-relaxed instance.
const OSIRIS_URL = (import.meta.env.VITE_OSIRIS_URL || 'https://osirisai.live').trim()

const FEATURES = [
  'Live flights', 'Maritime', 'Seismic', 'Active fires',
  'Conflict zones', '24/7 news', 'Satellites', 'RECON toolkit',
]

export default function WorldOpsPage() {
  return (
    <div className="biopunk" style={{
      minHeight: '100%', padding: 'clamp(24px, 4vw, 56px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Surface padding={0} style={{ maxWidth: 600, width: '100%', overflow: 'hidden' }}>
        {/* Hero scene */}
        <div style={{ position: 'relative', aspectRatio: '16 / 7', overflow: 'hidden' }}>
          <img src="/sprites/lobby-og.png" alt="" draggable={false}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', imageRendering: 'pixelated', filter: 'brightness(0.96)' }} />
          <div style={{ position: 'absolute', inset: 0,
            background: 'linear-gradient(180deg, transparent 40%, rgba(8,12,14,0.55) 100%)' }} />
          <div style={{ position: 'absolute', left: 18, bottom: 14 }}>
            <Tag tone="teal">World Ops · OSIRIS</Tag>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: 'clamp(20px, 4vw, 30px)' }}>
          <h1 style={{ margin: '0 0 8px', fontSize: 'var(--bp-text-2xl)', fontWeight: 700,
            letterSpacing: '-0.02em', color: 'var(--bp-ink)' }}>
            World Ops
          </h1>
          <p style={{ margin: '0 0 18px', fontSize: 'var(--bp-text-base)', lineHeight: 1.6,
            color: 'var(--bp-ink-muted)' }}>
            The live global-intelligence floor — OSIRIS aggregates real-time flight
            tracking, maritime, seismic, wildfire, conflict-zone and OSINT feeds into
            one GPU-rendered map, plus a full RECON toolkit. It runs as its own app.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 22 }}>
            {FEATURES.map(f => <Tag key={f} tone="sage">{f}</Tag>)}
          </div>

          <a className="bp-btn bp-btn--primary" href={OSIRIS_URL} target="_blank" rel="noreferrer"
            style={{ textDecoration: 'none', fontSize: 'var(--bp-text-base)', padding: '12px 24px' }}>
            Open OSIRIS ↗
          </a>
          <div style={{ marginTop: 10, fontFamily: 'var(--bp-font-mono)', fontSize: 'var(--bp-text-2xs)',
            letterSpacing: '0.08em', color: 'var(--bp-ink-faint)' }}>
            Opens {OSIRIS_URL.replace(/^https?:\/\//, '')} in a new tab
          </div>
        </div>
      </Surface>
    </div>
  )
}
