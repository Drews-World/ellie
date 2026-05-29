import { useState, useEffect, useRef, useCallback } from 'react'
import RoomShell from '../components/shared/RoomShell'
import api from '../lib/api'

// ── Keyframes ─────────────────────────────────────────────────────────────────
let _injected = false
function ensureKeyframes() {
  if (_injected || typeof document === 'undefined') return
  _injected = true
  const s = document.createElement('style')
  s.textContent = `
    @keyframes tf-ticker { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
    @keyframes tf-glow   { 0%,100%{opacity:.55;transform:scale(1)} 50%{opacity:.9;transform:scale(1.08)} }
    @keyframes tf-float  { 0%,100%{transform:translate(-50%,-50%) translateY(0)} 50%{transform:translate(-50%,-50%) translateY(-6px)} }
    @keyframes tf-ring   { 0%{opacity:.7;transform:translate(-50%,-50%) scale(.8)} 100%{opacity:0;transform:translate(-50%,-50%) scale(2.1)} }
    @keyframes tf-boot   { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
    @keyframes tf-flow   { 0%{transform:translateX(-120%);opacity:0} 15%{opacity:1} 85%{opacity:1} 100%{transform:translateX(220%);opacity:0} }
    @keyframes tf-vine   { 0%,100%{stroke-dashoffset:0} 50%{stroke-dashoffset:-20} }
    @keyframes tf-scan   { 0%{transform:translateY(0%)} 100%{transform:translateY(300%)} }
    @keyframes tf-slide-in { from{transform:translateX(100%);opacity:0} to{transform:translateX(0);opacity:1} }
    @keyframes tf-node-burst { 0%{opacity:0.7;transform:scale(0.85)} 100%{opacity:0;transform:scale(1.7)} }
    @keyframes tf-desk-blink { 0%,80%,100%{opacity:1} 90%{opacity:.25} }
  `
  document.head.appendChild(s)
}

// ── CDN helpers ───────────────────────────────────────────────────────────────
// Pixellab CDN base — same bucket as Business Factory agents
const _PL = 'https://backblaze.pixellab.ai/file/pixellab-characters/c44d0e95-f47c-4c39-96ed-91692c3f5537'
const _DIRS = ['south','east','north','west','south-east','south-west','north-east','north-west']
const _rot = id => Object.fromEntries(_DIRS.map(d => [d, [`${_PL}/${id}/rotations/${d}.png`]]))
const _anim = (cid, aid, dir, n=8) => Array.from({length:n},(_,i)=>`${_PL}/${cid}/animations/${aid}/${dir}/${i}.png`)

// ── Character IDs (generation in progress — sprites appear once CDN populates) ─
const CHAR = {
  quant:  '79f92340-8c3b-47c7-9c3e-5c591aeb0728',
  bull:   'd0016e72-bb3a-44c3-acf2-5604fbf666ea',
  trader: '1eb37793-f1cb-4c5a-a0d8-019a46afa58b',
  risk:   'f3c1eee9-6017-492e-a920-b752dfb082d4',
}
// Walk animation IDs — animation_name used when calling animate_character
// All 3 humanoid agents use "walk" (walking-8-frames template, 8 dirs each)
// Bull uses "walk" too once its animation completes
// CDN URL: ${_PL}/${charId}/animations/${aid}/${dir}/${frameIndex}.png
const WALK_ANIMS = {
  quant:  'walk',   // queued — processing
  bull:   null,     // queued after quant finishes
  trader: null,     // queued after quant finishes
  risk:   null,     // queued after quant finishes
}

// Build sprite config for a character
function mkSprite(key, opts) {
  const id  = CHAR[key]
  const idle = _rot(id)
  const aid  = WALK_ANIMS[key]
  const walkFrames = {}
  _DIRS.forEach(dir => {
    walkFrames[dir] = aid ? _anim(id, aid, dir) : []
  })
  return { id, idleFrames: idle, walkFrames, ...opts }
}

// ── Map sprite patrol config ───────────────────────────────────────────────────
const MOVE_MS = 3000
const SPRITE_SZ = 'clamp(72px, 7vw, 108px)'

const TF_SPRITES = [
  mkSprite('quant', {
    label: 'QUANT · ANALYSIS', taskIcon: '📊', glowColor: '72,187,255',
    interval: 5800,
    path: [
      { x: '9%',  y: '44%' },
      { x: '18%', y: '38%' },
      { x: '24%', y: '52%' },
      { x: '10%', y: '57%' },
    ],
  }),
  mkSprite('trader', {
    label: 'EXEC · TRADING', taskIcon: '⚡', glowColor: '255,178,63',
    interval: 4800,
    path: [
      { x: '22%', y: '76%' },
      { x: '38%', y: '80%' },
      { x: '55%', y: '76%' },
      { x: '68%', y: '80%' },
      { x: '52%', y: '72%' },
    ],
  }),
  mkSprite('risk', {
    label: 'RISK · MONITOR', taskIcon: '🛡️', glowColor: '34,211,164',
    interval: 6200,
    path: [
      { x: '82%', y: '38%' },
      { x: '90%', y: '44%' },
      { x: '85%', y: '56%' },
      { x: '76%', y: '48%' },
    ],
  }),
]

// ── Zone definitions ──────────────────────────────────────────────────────────
const ZONES = [
  { id: 'quant',   label: 'QUANT POD',    accent: '#48BBFF', accentRgb: '72,187,255',
    left: '1%',  top: '26%', w: '31%', h: '42%', chipX: '6%',  chipY: '27%' },
  { id: 'command', label: 'COMMAND',      accent: '#9B72FF', accentRgb: '155,114,255',
    left: '33%', top: '22%', w: '34%', h: '46%', chipX: '50%', chipY: '23%' },
  { id: 'risk',    label: 'RISK DESK',    accent: '#22D3A4', accentRgb: '34,211,164',
    left: '68%', top: '26%', w: '31%', h: '42%', chipX: '86%', chipY: '27%' },
  { id: 'exec',    label: 'EXEC BAY',     accent: '#FFB23F', accentRgb: '255,178,63',
    left: '1%',  top: '69%', w: '98%', h: '26%', chipX: '50%', chipY: '70%' },
]

// ── Desk grid positions ───────────────────────────────────────────────────────
const DESKS = [
  // Quant pod — left side
  { x: '5%',   y: '33%', color: '72,187,255'  },
  { x: '16%',  y: '30%', color: '72,187,255'  },
  { x: '24%',  y: '37%', color: '72,187,255'  },
  { x: '5%',   y: '52%', color: '72,187,255'  },
  { x: '18%',  y: '57%', color: '72,187,255'  },
  { x: '26%',  y: '49%', color: '72,187,255'  },
  // Risk desk — right side
  { x: '71%',  y: '33%', color: '34,211,164'  },
  { x: '82%',  y: '30%', color: '34,211,164'  },
  { x: '90%',  y: '37%', color: '34,211,164'  },
  { x: '72%',  y: '52%', color: '34,211,164'  },
  { x: '83%',  y: '57%', color: '34,211,164'  },
  { x: '91%',  y: '49%', color: '34,211,164'  },
  // Execution bay — bottom row
  { x: '9%',   y: '76%', color: '255,178,63'  },
  { x: '21%',  y: '79%', color: '255,178,63'  },
  { x: '33%',  y: '76%', color: '255,178,63'  },
  { x: '45%',  y: '79%', color: '255,178,63'  },
  { x: '57%',  y: '76%', color: '255,178,63'  },
  { x: '69%',  y: '79%', color: '255,178,63'  },
  { x: '81%',  y: '76%', color: '255,178,63'  },
  { x: '91%',  y: '79%', color: '255,178,63'  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function getWalkDir(from, to) {
  const dx = parseFloat(to.x) - parseFloat(from.x)
  const dy = parseFloat(to.y) - parseFloat(from.y)
  const adx = Math.abs(dx), ady = Math.abs(dy)
  if (adx < 0.5 && ady < 0.5) return 'south'
  if (adx > ady * 1.6) return dx > 0 ? 'east' : 'west'
  if (ady > adx * 1.6) return dy > 0 ? 'south' : 'north'
  if (dx > 0 && dy > 0) return 'south-east'
  if (dx > 0 && dy < 0) return 'north-east'
  if (dx < 0 && dy > 0) return 'south-west'
  return 'north-west'
}
const $$ = (v, d=2) => v == null ? '—' : `$${Math.abs(+v).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d})}`
const signColor = v => v == null ? 'rgba(170,165,220,.55)' : +v > 0 ? '#22D3A4' : +v < 0 ? '#FF5C72' : '#FFB23F'
const timeAgo = ts => {
  if (!ts) return '—'
  const d = Date.now() - new Date(ts).getTime()
  if (d < 60000) return 'just now'
  if (d < 3600000) return `${Math.floor(d/60000)}m ago`
  return `${Math.floor(d/3600000)}h ago`
}

// ── SVG: Wires and vines from ceiling ─────────────────────────────────────────
// viewBox 0 0 100 100 with preserveAspectRatio=none → coords are %
function WiresAndVines() {
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none"
      style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', zIndex:2 }}>
      {/* Main power conduits from corners to ELLIE center */}
      <path d="M 2 2 C 4 18, 30 28, 48 46"
        stroke="rgba(255,180,0,0.22)" strokeWidth="0.35" fill="none" strokeDasharray="2 1.5"
        style={{ animation: 'tf-vine 6s linear infinite' }} />
      <path d="M 98 2 C 96 18, 70 28, 52 46"
        stroke="rgba(255,180,0,0.22)" strokeWidth="0.35" fill="none" strokeDasharray="2 1.5"
        style={{ animation: 'tf-vine 6s linear infinite reverse' }} />
      {/* Data cables to zone edges */}
      <path d="M 0 42 C 2 42, 4 44, 31 46"
        stroke="rgba(72,187,255,0.18)" strokeWidth="0.28" fill="none" strokeDasharray="1.5 2" />
      <path d="M 100 42 C 98 42, 96 44, 69 46"
        stroke="rgba(34,211,164,0.18)" strokeWidth="0.28" fill="none" strokeDasharray="1.5 2" />
      <path d="M 50 100 C 50 95, 50 88, 50 72"
        stroke="rgba(255,178,63,0.18)" strokeWidth="0.28" fill="none" strokeDasharray="1.5 2" />
      {/* Organic vines — left wall */}
      <path d="M 0 6 C 3 10, 1 16, 4 22 C 6 28, 2 34, 5 40"
        stroke="rgba(50,160,80,0.35)" strokeWidth="0.5" fill="none" />
      <circle cx="3.5" cy="16" r="0.7" fill="rgba(50,200,80,0.5)" />
      <circle cx="4.2" cy="28" r="0.9" fill="rgba(50,200,80,0.4)" />
      <circle cx="4.8" cy="40" r="0.6" fill="rgba(50,200,80,0.45)" />
      {/* Organic vines — right wall */}
      <path d="M 100 10 C 97 15, 99 22, 96 28 C 94 34, 98 42, 95 50"
        stroke="rgba(50,160,80,0.35)" strokeWidth="0.5" fill="none" />
      <circle cx="96.5" cy="22" r="0.7" fill="rgba(50,200,80,0.5)" />
      <circle cx="95.2" cy="34" r="0.9" fill="rgba(50,200,80,0.4)" />
      <circle cx="95.8" cy="50" r="0.6" fill="rgba(50,200,80,0.45)" />
      {/* Top-center vine cluster (ceiling above jumbotron) */}
      <path d="M 35 0 C 38 5, 36 10, 40 14"
        stroke="rgba(50,160,80,0.3)" strokeWidth="0.45" fill="none" />
      <path d="M 65 0 C 62 5, 64 10, 60 14"
        stroke="rgba(50,160,80,0.3)" strokeWidth="0.45" fill="none" />
      <circle cx="40" cy="14" r="0.8" fill="rgba(50,200,80,0.45)" />
      <circle cx="60" cy="14" r="0.8" fill="rgba(50,200,80,0.45)" />
      {/* Central amber conduit network (floor-level circuit traces) */}
      <polyline points="48,46 40,46 40,70 50,70" stroke="rgba(255,180,0,0.12)" strokeWidth="0.2" fill="none" />
      <polyline points="52,46 60,46 60,70 50,70" stroke="rgba(255,180,0,0.12)" strokeWidth="0.2" fill="none" />
    </svg>
  )
}

// ── Desk object ───────────────────────────────────────────────────────────────
function Desk({ x, y, color }) {
  const [lit, setLit] = useState(Math.random() > 0.3)
  useEffect(() => {
    const id = setInterval(() => {
      if (Math.random() > 0.92) setLit(l => !l)
    }, 2000)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{
      position: 'absolute', left: x, top: y,
      transform: 'translate(-50%,-50%)',
      width: 40, height: 26, zIndex: 3, pointerEvents: 'none',
    }}>
      {/* Desk surface */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `rgba(8,10,20,0.95)`,
        border: `1px solid rgba(${color},0.45)`,
        boxShadow: lit ? `0 0 10px rgba(${color},0.25), inset 0 0 6px rgba(${color},0.06)` : 'none',
      }} />
      {/* Monitors (2 small rects on top edge) */}
      {[9, 22].map(lx => (
        <div key={lx} style={{
          position: 'absolute', left: lx, top: -8, width: 9, height: 7,
          background: lit ? `rgba(${color},0.7)` : 'rgba(20,20,35,0.9)',
          border: `0.5px solid rgba(${color},0.5)`,
          boxShadow: lit ? `0 0 6px rgba(${color},0.6)` : 'none',
          animation: lit ? 'tf-desk-blink 4s ease-in-out infinite' : 'none',
        }} />
      ))}
      {/* Keyboard strip */}
      <div style={{
        position: 'absolute', left: 6, bottom: 3, right: 6, height: 3,
        background: `rgba(${color},0.12)`,
        border: `0.5px solid rgba(${color},0.25)`,
      }} />
    </div>
  )
}

// ── Zone overlay ──────────────────────────────────────────────────────────────
function ZoneOverlay({ zone, active, onClick }) {
  return (
    <div onClick={onClick} style={{
      position: 'absolute', left: zone.left, top: zone.top, width: zone.w, height: zone.h,
      border: `1px solid rgba(${zone.accentRgb},${active ? '0.55' : '0.15'})`,
      background: active ? `rgba(${zone.accentRgb},0.05)` : 'transparent',
      boxShadow: active ? `inset 0 0 40px rgba(${zone.accentRgb},0.06)` : 'none',
      cursor: 'pointer', zIndex: 1, transition: 'all 0.25s',
      borderRadius: 0,
    }}
    onMouseEnter={e => { if (!active) e.currentTarget.style.background = `rgba(${zone.accentRgb},0.03)` }}
    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
    />
  )
}

// ── Zone chip label ───────────────────────────────────────────────────────────
function ZoneChip({ zone }) {
  return (
    <div style={{
      position: 'absolute', left: zone.chipX, top: zone.chipY,
      transform: 'translate(-50%,0)',
      zIndex: 4, pointerEvents: 'none',
      background: 'rgba(2,3,10,0.88)',
      border: `1px solid rgba(${zone.accentRgb},0.5)`,
      padding: '2px 8px',
      display: 'flex', alignItems: 'center', gap: 5,
    }}>
      <div style={{ width: 4, height: 4, borderRadius: '50%', background: zone.accent, boxShadow: `0 0 5px ${zone.accent}` }} />
      <span style={{ fontSize: 6, fontFamily: 'var(--font-mono)', fontWeight: 700, color: zone.accent, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
        {zone.label}
      </span>
    </div>
  )
}

// ── Live stat mini-overlay ────────────────────────────────────────────────────
function StatChip({ left, top, label, value, color, blink }) {
  return (
    <div style={{
      position: 'absolute', left, top, zIndex: 4, pointerEvents: 'none',
      background: 'rgba(2,3,10,0.92)', border: `1px solid rgba(${color},0.45)`,
      padding: '4px 9px', minWidth: 60, animation: 'tf-boot 0.3s ease-out both',
      boxShadow: `0 0 14px rgba(${color},0.2)`,
    }}>
      <div style={{ fontSize: 6, fontFamily: 'var(--font-mono)', color: `rgba(${color},0.55)`, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>
      <div style={{ fontSize: 14, fontFamily: 'var(--font-mono)', fontWeight: 700, color: `rgb(${color})`, lineHeight: 1.1, animation: blink ? 'tf-desk-blink 2.5s ease-in-out infinite' : 'none' }}>{value}</div>
    </div>
  )
}

// ── MapWalker sprite ──────────────────────────────────────────────────────────
function MapWalker({ sprite }) {
  const [posIdx, setPosIdx]     = useState(0)
  const [walking, setWalking]   = useState(false)
  const [walkDir, setWalkDir]   = useState('south')
  const [frameIdx, setFrameIdx] = useState(0)
  const mountedRef = useRef(true)
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])

  useEffect(() => {
    const id = setInterval(() => {
      if (!mountedRef.current) return
      setPosIdx(curr => {
        const next = (curr + 1) % sprite.path.length
        setWalkDir(getWalkDir(sprite.path[curr], sprite.path[next]))
        return next
      })
      setWalking(true); setFrameIdx(0)
      setTimeout(() => { if (mountedRef.current) setWalking(false) }, MOVE_MS - 500)
    }, sprite.interval)
    return () => clearInterval(id)
  }, [sprite.interval, sprite.path])

  useEffect(() => {
    const dirFrames = walking
      ? (sprite.walkFrames?.[walkDir] ?? sprite.walkFrames?.south ?? [])
      : (sprite.idleFrames?.[walkDir] ?? sprite.idleFrames?.south ?? [])
    if (!dirFrames.length) return
    const id = setInterval(() => {
      if (mountedRef.current) setFrameIdx(i => (i + 1) % dirFrames.length)
    }, walking ? 140 : 400)
    return () => clearInterval(id)
  }, [walking, walkDir, sprite.walkFrames, sprite.idleFrames])

  const pos = sprite.path[posIdx]
  const gc  = sprite.glowColor
  const dirFrames = walking
    ? (sprite.walkFrames?.[walkDir] ?? sprite.walkFrames?.south ?? [])
    : (sprite.idleFrames?.[walkDir] ?? sprite.idleFrames?.south ?? [])
  const src = dirFrames.length ? dirFrames[frameIdx % dirFrames.length] : null

  return (
    <div style={{
      position: 'absolute', left: pos.x, top: pos.y,
      transform: 'translate(-50%,-50%)', zIndex: 5, pointerEvents: 'none',
      transition: `left ${MOVE_MS}ms cubic-bezier(.45,0,.55,1), top ${MOVE_MS}ms cubic-bezier(.45,0,.55,1)`,
    }}>
      {/* Name chip */}
      <div style={{
        position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
        whiteSpace: 'nowrap', marginBottom: 3,
        opacity: walking ? 0 : 1, transition: 'opacity 0.4s',
        background: 'rgba(2,3,8,0.9)',
        border: `1px solid rgba(${gc},0.6)`,
        borderRadius: 2, padding: '2px 6px',
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        <span style={{ fontSize: 10 }}>{sprite.taskIcon}</span>
        <span style={{ fontSize: 6, fontFamily: 'var(--font-mono)', fontWeight: 700, color: `rgb(${gc})`, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{sprite.label}</span>
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: `rgb(${gc})`, boxShadow: `0 0 5px rgb(${gc})`, display: 'inline-block', animation: 'led-blink 1.2s ease-in-out infinite' }} />
      </div>
      {/* Sprite container */}
      <div style={{ width: SPRITE_SZ, height: SPRITE_SZ, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)', width: '140%', height: 10, background: `radial-gradient(ellipse, rgba(${gc},0.4) 0%, transparent 70%)`, borderRadius: '50%' }} />
        {src && (
          <img src={src} alt="" draggable={false}
            style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'pixelated', display: 'block', filter: `drop-shadow(0 0 5px rgba(${gc},0.8)) drop-shadow(0 2px 6px rgba(${gc},0.4))` }}
            onError={e => { e.currentTarget.style.display = 'none' }}
          />
        )}
      </div>
    </div>
  )
}

// ── ELLIE on map ──────────────────────────────────────────────────────────────
function EllieOnMap() {
  return (
    <div style={{
      position: 'absolute', left: '47%', top: '46%',
      transform: 'translate(-50%,-50%)',
      zIndex: 6, pointerEvents: 'none',
      animation: 'tf-float 3.5s ease-in-out infinite',
    }}>
      {/* Floor glow pool */}
      <div style={{
        position: 'absolute', bottom: -16, left: '50%', transform: 'translateX(-50%)',
        width: 200, height: 60,
        background: 'radial-gradient(ellipse, rgba(155,114,255,0.55) 0%, transparent 70%)',
        animation: 'tf-glow 2.4s ease-in-out infinite', borderRadius: '50%',
      }} />
      {/* Pulse rings */}
      {[0, 1].map(i => (
        <div key={i} style={{
          position: 'absolute', top: '50%', left: '50%',
          width: 80, height: 80, borderRadius: '50%',
          border: '1px solid rgba(155,114,255,0.6)',
          animation: `tf-ring 2.2s ease-out ${i * 1.1}s infinite`,
          pointerEvents: 'none',
        }} />
      ))}
      {/* Name plate */}
      <div style={{
        position: 'absolute', top: -26, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(2,2,10,0.95)', border: '1px solid rgba(155,114,255,0.7)',
        padding: '2px 10px', whiteSpace: 'nowrap', boxShadow: '0 0 14px rgba(155,114,255,0.35)',
      }}>
        <span style={{ fontSize: 7, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#9B72FF', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          ⬡ ELLIE · COMMAND
        </span>
      </div>
      <img
        src="/sprites/EllieSprite/angular_menacing_white_chrome_body_with_dark_biome/rotations/south.png"
        alt="ELLIE" draggable={false}
        style={{ width: 'clamp(160px,18vw,260px)', height: 'clamp(160px,18vw,260px)', objectFit: 'contain', imageRendering: 'pixelated', display: 'block', position: 'relative', zIndex: 1, filter: 'drop-shadow(0 0 16px rgba(155,114,255,0.9)) drop-shadow(0 0 32px rgba(155,114,255,0.4))' }}
      />
    </div>
  )
}

// ── Bull on map (static mascot) ───────────────────────────────────────────────
function BullOnMap() {
  const id = CHAR.bull
  return (
    <div style={{ position: 'absolute', left: '63%', top: '43%', transform: 'translate(-50%,-50%)', zIndex: 6, pointerEvents: 'none' }}>
      {/* Glow */}
      <div style={{ position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)', width: 100, height: 30, background: 'radial-gradient(ellipse, rgba(255,180,0,0.4) 0%, transparent 70%)', borderRadius: '50%' }} />
      {/* Name plate */}
      <div style={{ position: 'absolute', top: -22, left: '50%', transform: 'translateX(-50%)', background: 'rgba(2,2,10,0.95)', border: '1px solid rgba(255,180,0,0.6)', padding: '2px 8px', whiteSpace: 'nowrap' }}>
        <span style={{ fontSize: 6, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#FFB400', letterSpacing: '0.16em', textTransform: 'uppercase' }}>⬡ THE BULL</span>
      </div>
      <img
        src={`${_PL}/${id}/rotations/south.png`}
        alt="The Bull" draggable={false}
        style={{ width: 'clamp(80px,9vw,130px)', height: 'clamp(80px,9vw,130px)', objectFit: 'contain', imageRendering: 'pixelated', display: 'block', filter: 'drop-shadow(0 0 10px rgba(255,180,0,0.8)) drop-shadow(0 2px 12px rgba(255,180,0,0.4))' }}
        onError={e => { e.currentTarget.style.display = 'none' }}
      />
    </div>
  )
}

// ── Jumbotron (live market display at top) ────────────────────────────────────
function Jumbotron({ snap, orders, loading }) {
  const acct      = snap?.account ?? {}
  const positions = snap?.positions ?? []
  const equity    = acct.portfolio_value ?? acct.equity
  const pnl       = acct.pnl_today
  const pnlPct    = acct.pnl_today_pct
  const fund      = snap?.fund ?? {}
  const active    = fund.active && !fund.paused

  // Duplicate positions for seamless ticker scroll
  const tickerItems = positions.length ? [...positions, ...positions] : []

  return (
    <div style={{
      position: 'absolute', left: '11%', top: '2%', width: '78%', height: '21%',
      zIndex: 4, background: 'rgba(1,2,8,0.96)',
      border: '1.5px solid rgba(255,180,0,0.45)',
      boxShadow: '0 0 40px rgba(255,180,0,0.15), inset 0 0 30px rgba(255,180,0,0.04)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      animation: 'tf-boot 0.4s ease-out both',
    }}>
      {/* Top label bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 14px', background: 'rgba(0,0,0,0.5)', borderBottom: '1px solid rgba(255,180,0,0.2)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: active ? '#22D3A4' : '#FF5C72', boxShadow: active ? '0 0 6px rgba(34,211,164,0.8)' : 'none', animation: active ? 'led-blink 1.5s ease-in-out infinite' : 'none' }} />
          <span style={{ fontSize: 6, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'rgba(255,180,0,0.7)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            ELLIE TRADING FLOOR · MARKET DISPLAY
          </span>
        </div>
        <span style={{ fontSize: 6, fontFamily: 'var(--font-mono)', color: active ? '#22D3A4' : '#FF5C72', fontWeight: 700, letterSpacing: '0.1em' }}>
          {active ? '● FUND ACTIVE' : fund.paused ? '⏸ PAUSED' : '○ OFFLINE'}
        </span>
      </div>

      {/* Main data row */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 24, minHeight: 0 }}>
        {/* Portfolio value */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
          <span style={{ fontSize: 6, fontFamily: 'var(--font-mono)', color: 'rgba(255,180,0,0.45)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Portfolio</span>
          <span style={{ fontSize: 26, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#FFB400', lineHeight: 1, animation: 'led-blink 3s ease-in-out infinite' }}>
            {loading ? '—' : equity != null ? `$${(+equity).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}` : '—'}
          </span>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: '60%', background: 'rgba(255,180,0,0.2)' }} />

        {/* P&L */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
          <span style={{ fontSize: 6, fontFamily: 'var(--font-mono)', color: 'rgba(255,180,0,0.45)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Today P&amp;L</span>
          <span style={{ fontSize: 20, fontFamily: 'var(--font-mono)', fontWeight: 700, color: signColor(pnl), lineHeight: 1 }}>
            {loading ? '—' : pnl != null ? `${+pnl>=0?'+':'-'}${$$(pnl)}` : '—'}
          </span>
          {pnlPct != null && (
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: signColor(pnl) }}>
              {+pnlPct>=0?'+':''}{(+pnlPct).toFixed(2)}%
            </span>
          )}
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: '60%', background: 'rgba(255,180,0,0.2)' }} />

        {/* Positions count */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
          <span style={{ fontSize: 6, fontFamily: 'var(--font-mono)', color: 'rgba(255,180,0,0.45)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Positions</span>
          <span style={{ fontSize: 20, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#9B72FF', lineHeight: 1 }}>{positions.length}</span>
          <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'rgba(170,165,220,0.5)' }}>open</span>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Recent order flashes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end', flexShrink: 0, maxWidth: 200 }}>
          {(orders ?? []).slice(0, 3).map((o, i) => {
            const isBuy = o.side === 'buy'
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 1 - i * 0.3 }}>
                <span style={{ fontSize: 7, fontFamily: 'var(--font-mono)', fontWeight: 700, color: isBuy ? '#22D3A4' : '#FF5C72' }}>{isBuy ? '▲' : '▼'}</span>
                <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#E8E4FF' }}>{o.symbol}</span>
                <span style={{ fontSize: 7, fontFamily: 'var(--font-mono)', color: 'rgba(170,165,220,0.5)' }}>{o.status}</span>
              </div>
            )
          })}
          {!orders?.length && !loading && (
            <span style={{ fontSize: 7, fontFamily: 'var(--font-mono)', color: 'rgba(170,165,220,0.3)' }}>no recent orders</span>
          )}
        </div>
      </div>

      {/* Positions ticker strip at bottom */}
      {tickerItems.length > 0 && (
        <div style={{ height: 20, overflow: 'hidden', background: 'rgba(0,0,0,0.4)', borderTop: '1px solid rgba(255,180,0,0.15)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', height: '100%', width: 'max-content', animation: `tf-ticker ${positions.length * 5}s linear infinite` }}>
            {tickerItems.map((pos, i) => {
              const pl = +(pos.unrealized_pl ?? 0)
              const plpct = +(pos.unrealized_plpc ?? 0) * 100
              const c = signColor(pl)
              return (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '0 16px', borderRight: '1px solid rgba(255,180,0,0.08)', fontFamily: 'var(--font-mono)', fontSize: 8 }}>
                  <span style={{ color: '#E8E4FF', fontWeight: 700 }}>{pos.symbol}</span>
                  <span style={{ color: '#FFB400' }}>${(+pos.current_price).toFixed(2)}</span>
                  <span style={{ color: c, fontWeight: 700 }}>{pl >= 0 ? '▲' : '▼'}{Math.abs(plpct).toFixed(2)}%</span>
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Compact status bar ────────────────────────────────────────────────────────
function StatusBar({ snap, loading, refreshing, onRefresh }) {
  const fund   = snap?.fund ?? {}
  const active = fund.active && !fund.paused
  const acct   = snap?.account ?? {}
  const cash   = acct.cash
  const bp     = acct.buying_power
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '6px 24px', background: 'rgba(1,2,8,0.99)', borderBottom: '1px solid rgba(255,180,0,0.18)', flexShrink: 0, backgroundImage: 'repeating-linear-gradient(transparent 0,transparent 3px,rgba(0,0,0,0.1) 3px,rgba(0,0,0,0.1) 4px)', backgroundSize: '100% 4px' }}>
      <span style={{ fontSize: 7, fontFamily: 'var(--font-mono)', color: 'rgba(255,180,0,0.45)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>ELLIE TRADING FLOOR</span>
      <div style={{ width: 1, height: 14, background: 'rgba(255,180,0,0.2)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: active ? '#22D3A4' : '#6460A8', boxShadow: active ? '0 0 6px rgba(34,211,164,0.8)' : 'none', animation: active ? 'led-blink 1.5s ease-in-out infinite' : 'none' }} />
        <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700, color: active ? '#22D3A4' : 'rgba(170,165,220,0.45)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {active ? 'Fund Active' : fund.paused ? 'Fund Paused' : 'Fund Offline'}
        </span>
      </div>
      {cash != null && (
        <>
          <div style={{ width: 1, height: 14, background: 'rgba(255,180,0,0.15)' }} />
          <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'rgba(170,165,220,0.5)' }}>
            Cash: <span style={{ color: cash < 0 ? '#FF5C72' : '#48BBFF' }}>{cash < 0 ? '-' : ''}{$$(Math.abs(cash))}</span>
          </span>
        </>
      )}
      {bp != null && (
        <>
          <div style={{ width: 1, height: 14, background: 'rgba(255,180,0,0.15)' }} />
          <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'rgba(170,165,220,0.5)' }}>
            Buy Power: <span style={{ color: 'rgba(232,228,255,0.7)' }}>{$$(bp)}</span>
          </span>
        </>
      )}
      <div style={{ flex: 1 }} />
      <button onClick={onRefresh} disabled={refreshing} style={{ background: 'transparent', border: '1px solid rgba(255,180,0,0.3)', color: refreshing ? 'rgba(255,180,0,0.3)' : 'rgba(255,180,0,0.6)', fontFamily: 'var(--font-mono)', fontSize: 7, padding: '3px 10px', cursor: refreshing ? 'not-allowed' : 'pointer', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        {refreshing ? '⟳ …' : '⟳ SYNC'}
      </button>
    </div>
  )
}

// ── Zone detail side panel ────────────────────────────────────────────────────
function ZonePanel({ zone, snap, orders, log, backlog, loading, onClose, onLaunch, onPause }) {
  const acct      = snap?.account ?? {}
  const positions = snap?.positions ?? []
  const fund      = snap?.fund ?? {}
  const active    = fund.active && !fund.paused
  const [busy, setBusy] = useState(false)

  const content = {
    quant: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div style={{ padding: '8px 14px', fontSize: 8, fontFamily: 'var(--font-mono)', color: 'rgba(72,187,255,0.55)', borderBottom: '1px solid rgba(72,187,255,0.1)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Open Positions</div>
        {!positions.length
          ? <div style={{ padding: 16, fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(170,165,220,0.35)', textAlign: 'center' }}>— no positions —</div>
          : positions.map((p, i) => {
            const pl = +(p.unrealized_pl ?? 0)
            const plpct = +(p.unrealized_plpc ?? 0) * 100
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderBottom: '1px solid rgba(72,187,255,0.06)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#E8E4FF', fontSize: 11, width: 48, flexShrink: 0 }}>{p.symbol}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(170,165,220,0.6)', flex: 1 }}>{(+p.qty).toFixed(0)} sh @ ${(+p.avg_entry_price).toFixed(2)}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: signColor(pl) }}>{pl >= 0 ? '+' : '-'}{$$(Math.abs(pl))}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: signColor(pl) }}>{plpct >= 0 ? '+' : ''}{plpct.toFixed(1)}%</span>
              </div>
            )
          })
        }
      </div>
    ),
    command: (
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Fund state */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: active ? '#22D3A4' : '#6460A8', boxShadow: active ? '0 0 10px rgba(34,211,164,0.8)' : 'none', animation: active ? 'led-blink 1.5s ease-in-out infinite' : 'none' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: active ? '#22D3A4' : 'rgba(170,165,220,0.45)' }}>
            {loading ? 'CONNECTING…' : active ? 'FUND ACTIVE' : fund.paused ? 'FUND PAUSED' : 'FUND OFFLINE'}
          </span>
        </div>
        {/* Config rows */}
        {[
          ['STYLE', (fund.investment_style ?? '—').toUpperCase()],
          ['POSITION', fund.position_pct != null ? `${(fund.position_pct*100).toFixed(0)}%` : '—'],
          ['MAX POS',  fund.max_position_pct != null ? `${(fund.max_position_pct*100).toFixed(0)}%` : '—'],
          ['MIN HOLD', fund.min_hold_days != null ? `${fund.min_hold_days}d` : '—'],
        ].map(([k,v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(155,114,255,0.1)' }}>
            <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'rgba(170,165,220,0.45)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{k}</span>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#9B72FF' }}>{v}</span>
          </div>
        ))}
        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
          {!active && (
            <button onClick={async () => { setBusy(true); await onLaunch(); setBusy(false) }} disabled={busy || loading}
              style={{ background: 'rgba(34,211,164,0.1)', border: '1px solid rgba(34,211,164,0.55)', color: '#22D3A4', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 8, padding: '7px 14px', cursor: busy || loading ? 'not-allowed' : 'pointer', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: busy || loading ? 0.5 : 1 }}>
              ▶ LAUNCH
            </button>
          )}
          {active && (
            <button onClick={async () => { setBusy(true); await onPause(); setBusy(false) }} disabled={busy || loading}
              style={{ background: 'rgba(255,178,63,0.1)', border: '1px solid rgba(255,178,63,0.55)', color: '#FFB23F', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 8, padding: '7px 14px', cursor: busy || loading ? 'not-allowed' : 'pointer', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: busy || loading ? 0.5 : 1 }}>
              ⏸ PAUSE
            </button>
          )}
        </div>
        {/* Activity log preview */}
        <div>
          <div style={{ fontSize: 7, fontFamily: 'var(--font-mono)', color: 'rgba(155,114,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>RECENT ACTIVITY</div>
          {(log ?? []).slice(0, 6).map((e, i) => {
            const msg = e.message ?? e.detail ?? e.description ?? JSON.stringify(e)
            const ts  = e.timestamp ?? e.created_at
            return (
              <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: '1px solid rgba(155,114,255,0.06)' }}>
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#9B72FF', flexShrink: 0, marginTop: 4 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(232,228,255,0.75)', lineHeight: 1.4 }}>{msg}</div>
                  {ts && <div style={{ fontSize: 7, fontFamily: 'var(--font-mono)', color: 'rgba(170,165,220,0.3)', marginTop: 1 }}>{timeAgo(ts)}</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    ),
    risk: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div style={{ padding: '8px 14px', fontSize: 8, fontFamily: 'var(--font-mono)', color: 'rgba(34,211,164,0.55)', borderBottom: '1px solid rgba(34,211,164,0.1)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Risk Metrics</div>
        {[
          ['Cash', acct.cash != null ? (acct.cash < 0 ? `-${$$(Math.abs(acct.cash))}` : $$(acct.cash)) : '—', acct.cash < 0 ? '#FF5C72' : '#48BBFF'],
          ['Buying Power', acct.buying_power != null ? $$(acct.buying_power) : '—', 'rgba(232,228,255,0.8)'],
          ['Open Positions', positions.length, '#22D3A4'],
          ['Backlog Items', backlog?.length ?? 0, backlog?.length > 0 ? '#FFB23F' : 'rgba(170,165,220,0.55)'],
        ].map(([k,v,c]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid rgba(34,211,164,0.06)' }}>
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(170,165,220,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{k}</span>
            <span style={{ fontSize: 14, fontFamily: 'var(--font-mono)', fontWeight: 700, color: c }}>{v}</span>
          </div>
        ))}
        {/* Backlog */}
        {backlog?.length > 0 && (
          <>
            <div style={{ padding: '8px 14px', fontSize: 8, fontFamily: 'var(--font-mono)', color: 'rgba(255,178,63,0.55)', borderBottom: '1px solid rgba(255,178,63,0.1)', borderTop: '1px solid rgba(34,211,164,0.08)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Buy Backlog</div>
            {backlog.slice(0, 5).map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 14px', borderBottom: '1px solid rgba(255,178,63,0.06)' }}>
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#FFB23F', boxShadow: '0 0 4px rgba(255,178,63,0.7)', animation: 'led-blink 1.5s ease-in-out infinite' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: '#E8E4FF', flex: 1 }}>{item.ticker ?? item.symbol ?? '?'}</span>
                {item.notional && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#FFB400' }}>${(+item.notional).toFixed(2)}</span>}
              </div>
            ))}
          </>
        )}
      </div>
    ),
    exec: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div style={{ padding: '8px 14px', fontSize: 8, fontFamily: 'var(--font-mono)', color: 'rgba(255,178,63,0.55)', borderBottom: '1px solid rgba(255,178,63,0.1)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Recent Orders</div>
        {!(orders ?? []).length
          ? <div style={{ padding: 16, fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(170,165,220,0.35)', textAlign: 'center' }}>— no orders —</div>
          : (orders ?? []).slice(0, 12).map((o, i) => {
            const isBuy = o.side === 'buy'
            const sc = o.status === 'filled' ? '#22D3A4' : o.status === 'canceled' ? '#FF5C72' : '#FFB23F'
            return (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '9px 14px', borderBottom: '1px solid rgba(255,178,63,0.06)' }}>
                <div style={{ width: 30, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isBuy ? 'rgba(34,211,164,0.12)' : 'rgba(255,92,114,0.12)', border: `1px solid ${isBuy ? 'rgba(34,211,164,0.5)' : 'rgba(255,92,114,0.5)'}`, fontSize: 6, fontFamily: 'var(--font-mono)', fontWeight: 700, color: isBuy ? '#22D3A4' : '#FF5C72', flexShrink: 0 }}>
                  {isBuy ? 'BUY' : 'SELL'}
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#E8E4FF', fontSize: 10, width: 44, flexShrink: 0 }}>{o.symbol}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(170,165,220,0.55)', flex: 1 }}>
                  {o.filled_qty ? `${(+o.filled_qty).toFixed(2)} sh` : o.notional ? `$${(+o.notional).toFixed(0)}` : '—'}
                </span>
                <span style={{ fontSize: 7, fontFamily: 'var(--font-mono)', fontWeight: 700, color: sc, textTransform: 'uppercase' }}>{o.status}</span>
              </div>
            )
          })
        }
      </div>
    ),
  }

  return (
    <div style={{
      position: 'absolute', right: 0, top: 0, bottom: 0, width: 320,
      background: 'rgba(1,2,8,0.98)', border: 'none',
      borderLeft: `1px solid rgba(${zone.accentRgb},0.4)`,
      zIndex: 20, display: 'flex', flexDirection: 'column',
      boxShadow: `-20px 0 60px rgba(0,0,0,0.8)`,
      animation: 'tf-slide-in 0.25s ease-out both',
    }}>
      {/* Panel header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: `1px solid rgba(${zone.accentRgb},0.25)`, background: 'rgba(0,0,0,0.4)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 6, height: 6, background: zone.accent, boxShadow: `0 0 8px ${zone.accent}` }} />
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: zone.accent, textTransform: 'uppercase', letterSpacing: '0.15em' }}>{zone.label}</span>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(170,165,220,0.5)', fontSize: 14, cursor: 'pointer', padding: '2px 6px', lineHeight: 1 }}>✕</button>
      </div>
      {/* Panel body */}
      <div style={{ flex: 1, overflowY: 'auto' }}>{content[zone.id]}</div>
    </div>
  )
}

// ── Main map ──────────────────────────────────────────────────────────────────
function TradingFloorMap({ snap, orders, log, backlog, loading, selectedZone, onZoneClick }) {
  const acct = snap?.account ?? {}

  return (
    <div style={{
      position: 'relative', flex: 1, overflow: 'hidden',
      background: 'rgba(2,3,10,0.99)',
      // Dark circuit-grid floor
      backgroundImage: [
        'radial-gradient(ellipse 70% 50% at 50% 48%, rgba(155,114,255,0.06) 0%, transparent 70%)',
        'radial-gradient(ellipse 80% 25% at 50% 10%, rgba(255,180,0,0.04) 0%, transparent 70%)',
        'linear-gradient(rgba(255,180,0,0.035) 1px, transparent 1px)',
        'linear-gradient(90deg, rgba(255,180,0,0.035) 1px, transparent 1px)',
      ].join(', '),
      backgroundSize: 'cover, cover, 48px 48px, 48px 48px',
    }}>

      {/* Zone overlays (clickable) */}
      {ZONES.map(z => (
        <ZoneOverlay key={z.id} zone={z} active={selectedZone?.id === z.id} onClick={() => onZoneClick(z)} />
      ))}

      {/* Zone labels */}
      {ZONES.map(z => <ZoneChip key={z.id} zone={z} />)}

      {/* SVG wires and vines */}
      <WiresAndVines />

      {/* Desk objects */}
      {DESKS.map((d, i) => <Desk key={i} {...d} />)}

      {/* Wall accent strips */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, transparent, rgba(255,180,0,0.4), rgba(255,180,0,0.6), rgba(255,180,0,0.4), transparent)', pointerEvents: 'none', zIndex: 2 }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, rgba(255,180,0,0.25), transparent)', pointerEvents: 'none', zIndex: 2 }} />
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: 'linear-gradient(180deg, rgba(255,180,0,0.3), rgba(255,180,0,0.1), rgba(255,180,0,0.3))', pointerEvents: 'none', zIndex: 2 }} />
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 2, background: 'linear-gradient(180deg, rgba(255,180,0,0.3), rgba(255,180,0,0.1), rgba(255,180,0,0.3))', pointerEvents: 'none', zIndex: 2 }} />

      {/* Corner bracket decorations */}
      {[['top:4px;left:4px;border-top:1px solid;border-left:1px solid','255,180,0'],
        ['top:4px;right:4px;border-top:1px solid;border-right:1px solid','255,180,0'],
        ['bottom:4px;left:4px;border-bottom:1px solid;border-left:1px solid','255,180,0'],
        ['bottom:4px;right:4px;border-bottom:1px solid;border-right:1px solid','255,180,0']].map(([s,c],i) => (
        <div key={i} style={Object.fromEntries([...s.split(';').map(p => { const [k,v]=p.split(':'); return [k.replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),v] }), ['position','absolute'],['width','18px'],['height','18px'],[`borderColor`,`rgba(${c},0.55)`],['pointerEvents','none'],['zIndex','3']])} />
      ))}

      {/* Jumbotron (top center) */}
      <Jumbotron snap={snap} orders={orders} loading={loading} />

      {/* Live stat overlays per zone */}
      {acct.portfolio_value != null && (
        <StatChip left="3%" top="26%" label="P&L Today" value={acct.pnl_today != null ? `${acct.pnl_today>=0?'+':'-'}${$$(Math.abs(acct.pnl_today))}` : '—'} color="72,187,255" blink />
      )}
      {acct.buying_power != null && (
        <StatChip left="69%" top="26%" label="Buy Power" value={$$(acct.buying_power)} color="34,211,164" />
      )}
      {orders != null && (
        <StatChip left="1%" top="69.5%" label="Orders Today" value={orders.length} color="255,178,63" />
      )}

      {/* Character sprites */}
      {TF_SPRITES.map(s => <MapWalker key={s.id} sprite={s} />)}

      {/* ELLIE at command center */}
      <EllieOnMap />

      {/* The Bull */}
      <BullOnMap />

      {/* Scan line overlay */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10, overflow: 'hidden', opacity: 0.03 }}>
        <div style={{ position: 'absolute', left: 0, right: 0, height: '30%', background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.8), transparent)', animation: 'tf-scan 8s linear infinite' }} />
      </div>

      {/* "Click zone to drill down" hint */}
      {!selectedZone && (
        <div style={{ position: 'absolute', bottom: 6, right: 10, zIndex: 4, pointerEvents: 'none', fontSize: 7, fontFamily: 'var(--font-mono)', color: 'rgba(170,165,220,0.25)', letterSpacing: '0.1em' }}>
          CLICK ZONE TO DRILL DOWN
        </div>
      )}
    </div>
  )
}

// ── Root component ────────────────────────────────────────────────────────────
export default function TradingFloor() {
  ensureKeyframes()

  const [snap,      setSnap]      = useState(null)
  const [orders,    setOrders]    = useState(null)
  const [log,       setLog]       = useState(null)
  const [backlog,   setBacklog]   = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [refreshing,setRefreshing]= useState(false)
  const [zone,      setZone]      = useState(null)  // selected zone for detail panel
  const mountedRef = useRef(true)

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])

  const fetchAll = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true); else setRefreshing(true)
    const [snapR, ordR, logR, blR] = await Promise.allSettled([
      api.get('/trading/snapshot'),
      api.get('/trading/orders'),
      api.get('/trading/fund/log'),
      api.get('/trading/fund/backlog'),
    ])
    if (!mountedRef.current) return
    if (snapR.status === 'fulfilled') setSnap(snapR.value.data)
    if (ordR.status  === 'fulfilled') setOrders(ordR.value.data)
    if (logR.status  === 'fulfilled') setLog(logR.value.data)
    if (blR.status   === 'fulfilled') setBacklog(blR.value.data)
    setLoading(false); setRefreshing(false)
  }, [])

  useEffect(() => {
    fetchAll()
    const id = setInterval(() => fetchAll(true), 30000)
    return () => clearInterval(id)
  }, [fetchAll])

  const handleLaunch = async () => { await api.post('/trading/fund/launch').catch(()=>null); fetchAll(true) }
  const handlePause  = async () => { await api.post('/trading/fund/pause').catch(()=>null);  fetchAll(true) }

  const handleZoneClick = (z) => setZone(prev => prev?.id === z.id ? null : z)

  return (
    <RoomShell
      title="Trading Floor"
      gradient="linear-gradient(135deg, #FFB23F 0%, #FF8A66 100%)"
      icon="📈"
      outerStyle={{ background: 'rgba(1,2,8,0.99)', backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,180,0,0.025) 39px, rgba(255,180,0,0.025) 40px)' }}
      contentStyle={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      headerStyle={{ background: 'rgba(2,3,10,0.98)', borderBottom: '1px solid rgba(255,180,0,0.25)' }}
    >
      <StatusBar snap={snap} loading={loading} refreshing={refreshing} onRefresh={() => fetchAll(true)} />

      {/* Map + optional side panel */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', minHeight: 0 }}>
        <TradingFloorMap
          snap={snap} orders={orders} log={log} backlog={backlog}
          loading={loading} selectedZone={zone} onZoneClick={handleZoneClick}
        />
        {zone && (
          <ZonePanel
            zone={zone} snap={snap} orders={orders} log={log} backlog={backlog} loading={loading}
            onClose={() => setZone(null)}
            onLaunch={handleLaunch}
            onPause={handlePause}
          />
        )}
      </div>
    </RoomShell>
  )
}
