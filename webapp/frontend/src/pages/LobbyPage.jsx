import { useState, useEffect } from 'react'
import { useUser } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import Mascot from '../components/shared/Mascot'
import { StatusDot } from '../components/ui'
import api from '../lib/api'
import { tfetch } from '../trading/lib/tapi'

// Floor portals — a glowing doorway into each floor, with a scene preview.
const FLOORS = [
  {
    to: '/trading', label: 'Trading Floor', sub: 'Markets & P&L', wing: 'Wing A',
    accent: 'var(--bp-amber)', scene: '/sprites/lobby-trading.png',
    desc: 'Live positions, fund controls, P&L, and the multi-agent analysis crew.',
  },
  {
    to: '/business', label: 'Business Factory', sub: 'Agent Crew', wing: 'Wing B',
    accent: 'var(--bp-ellie)', scene: '/sprites/lobby-business.png',
    desc: "ELLIE's crew researches niches, forges designs, and ships them to Etsy.",
  },
  {
    to: '/world-ops', label: 'World Ops', sub: 'Live Intelligence', wing: 'Wing C',
    accent: 'var(--bp-accent)', scene: '/sprites/lobby-og.png',
    desc: 'Real-time global OSINT — flights, maritime, quakes, fires, conflict zones, and the RECON toolkit.',
  },
  {
    to: '/suite', label: 'Owner Suite', sub: 'Personal Command', wing: 'Wing D',
    accent: 'var(--bp-sage)', emblem: '◇',
    desc: 'Calendar, notes, goals, prayer board, and ELLIE’s memory of your world.',
  },
  {
    to: '/comms', label: 'Comms Bay', sub: 'Coming soon', wing: 'Wing E',
    accent: 'var(--bp-clay)', scene: '/sprites/lobby-coming-soon.png', disabled: true,
    desc: 'Messaging, media, and more rooms on the way.',
  },
]

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// Small L-bracket in a portal corner
function Bracket({ v, h, accent }) {
  return (
    <span aria-hidden style={{
      position: 'absolute', [v]: 8, [h]: 8, width: 12, height: 12, zIndex: 4,
      [`border${v[0].toUpperCase()}${v.slice(1)}`]: `1.5px solid ${accent}`,
      [`border${h[0].toUpperCase()}${h.slice(1)}`]: `1.5px solid ${accent}`,
      opacity: 0.7, pointerEvents: 'none',
    }} />
  )
}

function FloorPortal({ floor, status }) {
  const navigate = useNavigate()
  const go = () => { if (!floor.disabled) navigate(floor.to) }
  const a = floor.accent
  return (
    <button
      className="bp-portal"
      onClick={go}
      disabled={floor.disabled}
      aria-label={floor.label}
      style={{ '--pa': a, display: 'block', textAlign: 'left', font: 'inherit', color: 'inherit' }}
    >
      {/* Scene preview */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: '3 / 3.4', overflow: 'hidden' }}>
        {floor.scene ? (
          <img
            src={floor.scene} alt="" draggable={false} className="bp-portal-scene"
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', imageRendering: 'pixelated',
              filter: floor.disabled ? 'brightness(0.7) saturate(0.7)' : 'brightness(0.92)',
            }}
          />
        ) : (
          <div className="bp-portal-scene" aria-hidden style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `radial-gradient(120% 90% at 50% 22%, color-mix(in srgb, ${a} 32%, #11140f) 0%, #0c0f0a 70%)`,
          }}>
            <span style={{ fontSize: 'clamp(48px, 8vw, 88px)', color: a, opacity: 0.85,
              textShadow: `0 0 26px color-mix(in srgb, ${a} 60%, transparent)` }}>
              {floor.emblem || '◆'}
            </span>
          </div>
        )}

        {/* Corner brackets */}
        <Bracket v="top" h="left" accent={a} />
        <Bracket v="top" h="right" accent={a} />
        <Bracket v="bottom" h="left" accent={a} />
        <Bracket v="bottom" h="right" accent={a} />

        {/* Top row: wing badge + live status */}
        <div style={{ position: 'absolute', top: 12, left: 12, right: 12, zIndex: 5,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{
            padding: '3px 9px', borderRadius: 'var(--bp-r-pill)',
            background: 'color-mix(in srgb, ' + a + ' 22%, rgba(8,10,14,0.7))',
            border: `1px solid color-mix(in srgb, ${a} 60%, transparent)`,
            color: '#fff', fontFamily: 'var(--bp-font-mono)', fontSize: 10,
            letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>{floor.wing}</span>
          {status && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '3px 9px', borderRadius: 'var(--bp-r-pill)',
              background: 'rgba(8,10,14,0.65)', backdropFilter: 'blur(4px)',
              color: 'rgba(255,255,255,0.9)', fontFamily: 'var(--bp-font-mono)', fontSize: 10 }}>
              <StatusDot status={status.dot} size={6} />{status.text}
            </span>
          )}
        </div>

        {/* Bottom gradient + labels */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 5,
          padding: '40px 16px 16px',
          background: 'linear-gradient(0deg, rgba(7,9,12,0.96) 28%, rgba(7,9,12,0.55) 70%, transparent 100%)',
        }}>
          <div style={{ fontFamily: 'var(--bp-font-mono)', fontSize: 10, fontWeight: 600,
            letterSpacing: '0.16em', textTransform: 'uppercase',
            color: a, marginBottom: 5 }}>{floor.sub}</div>
          <div style={{ fontSize: 'var(--bp-text-lg)', fontWeight: 700, color: '#F6F2E8',
            letterSpacing: '-0.01em', marginBottom: 6 }}>{floor.label}</div>
          <p style={{ margin: 0, fontSize: 'var(--bp-text-xs)', lineHeight: 1.5,
            color: 'rgba(232,230,221,0.62)' }}>{floor.desc}</p>
          <div className="bp-portal-enter" style={{
            marginTop: 12, fontFamily: 'var(--bp-font-mono)', fontSize: 10,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            color: floor.disabled ? 'rgba(232,230,221,0.4)' : 'rgba(232,230,221,0.7)' }}>
            {floor.disabled ? 'Locked' : 'Enter →'}
          </div>
        </div>
      </div>

      {/* Threshold glow line */}
      <span className="bp-portal-threshold" aria-hidden style={{
        position: 'absolute', bottom: 0, left: '12%', right: '12%', height: 2, zIndex: 6,
        background: `linear-gradient(90deg, transparent, ${a}, transparent)`,
      }} />
    </button>
  )
}

export default function LobbyPage() {
  const { user } = useUser()
  const firstName = user?.firstName || 'Drew'
  const [statuses, setStatuses] = useState({})

  // Best-effort live status for the portals. Never blocks; fails to neutral.
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { data } = await api.get('/business/status')
        const n = data?.agents?.length ?? 0
        if (alive) setStatuses(s => ({ ...s, '/business': { dot: 'online', text: n ? `${n} agents` : 'online' } }))
      } catch { /* offline — leave neutral */ }
      try {
        const r = await tfetch('/monitor'); const d = await r.json()
        const unread = (d.alerts || []).filter(a => !a.read).length
        if (alive) setStatuses(s => ({ ...s, '/trading': { dot: 'online', text: unread ? `${unread} alerts` : 'online' } }))
      } catch { /* offline */ }
    })()
    return () => { alive = false }
  }, [])

  return (
    <div className="biopunk" style={{
      minHeight: '100%', padding: 'clamp(24px, 4vw, 56px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <div style={{ width: '100%', maxWidth: 1140, animation: 'bp-fade-up 0.5s var(--bp-ease) both' }}>

        {/* ── Hero ── */}
        <header style={{ display: 'flex', alignItems: 'center', gap: 'clamp(18px, 3vw, 36px)',
          marginBottom: 'clamp(26px, 4vw, 44px)', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <svg aria-hidden viewBox="0 0 200 200" style={{
              position: 'absolute', inset: '-26%', width: '152%', height: '152%',
              opacity: 0.5, pointerEvents: 'none' }}>
              <circle cx="100" cy="100" r="92" fill="none" stroke="var(--bp-accent)"
                strokeWidth="1" strokeDasharray="3 9" opacity="0.5" />
              <circle cx="100" cy="100" r="72" fill="none" stroke="var(--bp-accent)"
                strokeWidth="1" strokeDasharray="40 240" opacity="0.7" />
            </svg>
            <Mascot size={112} />
          </div>

          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ fontFamily: 'var(--bp-font-mono)', fontSize: 'var(--bp-text-2xs)',
              letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--bp-accent-deep)',
              marginBottom: 10 }}>ELLIE Hub · Command Lobby</div>
            <h1 style={{ margin: 0, fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 700,
              letterSpacing: '-0.02em', color: 'var(--bp-ink)', lineHeight: 1.08 }}>
              {greeting()}, {firstName}.
            </h1>
            <p style={{ margin: '12px 0 0', fontSize: 'var(--bp-text-base)', lineHeight: 1.6,
              color: 'var(--bp-ink-muted)', maxWidth: '54ch' }}>
              Your crews are standing by. Step through a doorway to watch the agents
              work — or just tell me what you need from the bar below.
            </p>
          </div>
        </header>

        {/* ── Floor portals ── */}
        <div style={{
          display: 'grid', gap: 'clamp(16px, 2vw, 26px)',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
        }}>
          {FLOORS.map(f => (
            <FloorPortal key={f.to} floor={f} status={statuses[f.to]} />
          ))}
        </div>
      </div>
    </div>
  )
}
