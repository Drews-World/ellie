import { useState, useEffect, useRef, useCallback } from 'react'
import RoomShell from '../components/shared/RoomShell'
import StatusPill from '../components/shared/StatusPill'
import api from '../lib/api'
import AgentRoom from '../components/business/AgentRoom'

// ── Shared room card wrapper ──────────────────────────────────────────────────
function Room({ icon, name, accent, status, action, children, style = {} }) {
  return (
    <div style={{
      background: 'var(--paper-50)',
      border: '1.5px solid var(--ink-300)',
      borderRadius: 'var(--radius-lg)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-sm)',
      ...style,
    }}>
      {/* Room header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 16px',
        borderBottom: '1px solid var(--paper-200)',
        background: 'var(--paper-100)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontWeight: 800, fontSize: 'var(--text-sm)', color: 'var(--ink-900)', letterSpacing: '-0.01em' }}>{name}</span>
        <StatusPill status={status ?? 'offline'} label={status ?? 'offline'} />
        {action && <div style={{ marginLeft: 'auto' }}>{action}</div>}
      </div>
      {/* Room body */}
      <div style={{ flex: 1, padding: 16, overflowY: 'auto', minHeight: 0 }}>
        {children}
      </div>
    </div>
  )
}

function Btn({ onClick, disabled, color = 'var(--violet-500)', children, small }) {
  return (
    <button onClick={onClick} disabled={disabled} className="btn-game" style={{
      background: `color-mix(in srgb, ${color} 8%, rgba(2,3,10,0.92))`,
      border: `1px solid ${color}`,
      color,
      fontWeight: 700,
      fontSize: small ? 9 : 10,
      padding: small ? '4px 11px' : '7px 16px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.38 : 1,
      whiteSpace: 'nowrap',
      boxShadow: disabled ? 'none' : `0 0 8px color-mix(in srgb, ${color} 22%, transparent)`,
    }}>{children}</button>
  )
}

// ── Game-style header button (larger, more dramatic) ──────────────────────────
function GameBtn({ onClick, disabled, color = '#FFE600', children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="btn-game"
      style={{
        background: `color-mix(in srgb, ${color} 7%, rgba(1,2,8,0.95))`,
        border: `1px solid ${color}`,
        color,
        fontWeight: 700,
        fontSize: 10,
        padding: '7px 20px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.38 : 1,
        boxShadow: disabled ? 'none' : `0 0 14px color-mix(in srgb, ${color} 35%, transparent), inset 0 0 0 1px color-mix(in srgb, ${color} 8%, transparent)`,
        position: 'relative',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.boxShadow = `0 0 28px color-mix(in srgb, ${color} 65%, transparent)` }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.boxShadow = `0 0 14px color-mix(in srgb, ${color} 35%, transparent), inset 0 0 0 1px color-mix(in srgb, ${color} 8%, transparent)` }}
    >
      {/* Corner brackets */}
      {[['top','left'],['top','right'],['bottom','left'],['bottom','right']].map(([v,h]) => (
        <span key={v+h} style={{
          position: 'absolute',
          [v]: 2, [h]: 2,
          width: 6, height: 6,
          [`border${v === 'top' ? 'Top' : 'Bottom'}`]: `1.5px solid ${color}`,
          [`border${h === 'left' ? 'Left' : 'Right'}`]: `1.5px solid ${color}`,
          opacity: 0.85,
          pointerEvents: 'none',
        }} />
      ))}
      {children}
    </button>
  )
}

function Label({ children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-600)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
      {children}
    </div>
  )
}

function Empty({ children }) {
  return <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-500)', fontStyle: 'italic' }}>{children}</p>
}

function Corridor({ direction }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        [direction === 'h' ? 'width' : 'height']: '100%',
        [direction === 'h' ? 'height' : 'width']: 1,
        background: 'rgba(255,220,0,0.42)',
        boxShadow: '0 0 7px rgba(255,220,0,0.28)',
        position: 'relative', overflow: 'hidden',
      }} />
    </div>
  )
}

function CorridorIntersection() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        width: 4, height: 4, borderRadius: 99,
        background: 'rgba(255,220,0,0.7)',
        boxShadow: '0 0 7px rgba(255,220,0,0.55)',
      }} />
    </div>
  )
}

// ── Pipeline stages bar ───────────────────────────────────────────────────────
const PIPELINE_STAGES = ['Nova', 'Forge', 'Review', 'Publish']
const FORGE_STEPS = new Set(['designing', 'imaging', 'concepts', 'scoring', 'saving'])

// ── Office map room zones ─────────────────────────────────────────────────────
// Original map: 400×320 cross-shaped biopunk complex, ELLIE central circular chamber
const MAP_ROOMS = [
  {
    id: 'ellie',
    label: 'ELLIE HQ',
    accent: '#9B72FF', accentRgb: '155,114,255',
    zoneLeft: '27%', zoneTop: '22%', zoneW: '46%', zoneH: '52%',
    chipLeft: '50%', chipTop: '24%',
  },
  {
    id: 'nova',
    label: 'Nova',
    accent: '#22D3A4', accentRgb: '34,211,164',
    zoneLeft: '0%',  zoneTop: '0%',  zoneW: '30%', zoneH: '40%',
    chipLeft: '15%', chipTop: '2%',
  },
  {
    id: 'activity',
    label: 'Activity',
    accent: '#48BBFF', accentRgb: '72,187,255',
    zoneLeft: '70%', zoneTop: '0%',  zoneW: '30%', zoneH: '40%',
    chipLeft: '85%', chipTop: '2%',
  },
  {
    id: 'forge',
    label: 'Forge',
    accent: '#FFB23F', accentRgb: '255,178,63',
    zoneLeft: '0%',  zoneTop: '60%', zoneW: '30%', zoneH: '40%',
    chipLeft: '15%', chipTop: '61%',
  },
  {
    id: 'archives',
    label: 'Archives',
    accent: '#FF6BA8', accentRgb: '255,107,168',
    zoneLeft: '27%', zoneTop: '73%', zoneW: '46%', zoneH: '27%',
    chipLeft: '50%', chipTop: '74%',
  },
  {
    id: 'treasury',
    label: 'Treasury',
    accent: '#FFD600', accentRgb: '255,214,0',
    zoneLeft: '70%', zoneTop: '60%', zoneW: '30%', zoneH: '40%',
    chipLeft: '85%', chipTop: '61%',
  },
]

// ── Agent sprites + patrol paths (% of map container) ────────────────────────
// Calibrated for original 400×320 cross-shaped biopunk map
const MOVE_MS = 2800

// Responsive sprite display size — scales with viewport so sprites stay
// proportional on any screen; JS shadow calc no longer needs a pixel number.
const SPRITE_DISPLAY = 'clamp(90px, 8vw, 144px)'

// Pixellab CDN base — rotation stills per direction (loaded immediately)
const _PL = 'https://backblaze.pixellab.ai/file/pixellab-characters/c44d0e95-f47c-4c39-96ed-91692c3f5537'
const _DIRS = ['south','east','north','west','south-east','north-east','north-west','south-west']
function _rotFrames(charId) {
  return Object.fromEntries(_DIRS.map(d => [d, [`${_PL}/${charId}/rotations/${d}.png`]]))
}
// Generate sequential frame URLs from a completed Pixellab animation job
function _animFrames(charId, animId, dir, count = 8) {
  return Array.from({ length: count }, (_, i) =>
    `${_PL}/${charId}/animations/${animId}/${dir}/${i}.png`
  )
}

const MAP_SPRITES = [
  {
    id: 'worker-nova',
    src: '/sprites/sprite-nova.png',
    roomId: 'nova',
    w: 120, h: 120, taskIcon: '🔭', glowColor: '34,211,164',
    label: 'NOVA · RESEARCH',
    interval: 5200,
    // walkFrames: real 8-frame walk cycles from Pixellab (6/8 dirs complete; SE+NE fall back to rotation stills)
    walkFrames: (() => {
      const id = '061aa986-6340-4e23-acc5-a984bfe8ad0c'
      return {
        south:       _animFrames(id, 'c57d0122-e793-44a7-913b-4885dd08218a', 'south'),
        north:       _animFrames(id, '455784c5-7088-4cb8-b690-4577545f254b', 'north'),
        east:        _animFrames(id, 'e55c458d-07ee-41e2-9011-64f2359ba90d', 'east'),
        west:        _animFrames(id, 'a25c0dc1-5d5b-48f9-bd5b-d1e0e9263db7', 'west'),
        'south-west':_animFrames(id, 'e87c591a-8937-401c-a4d4-128c5313fb50', 'south-west'),
        'north-west':_animFrames(id, '4b7f204e-5b55-4596-a83d-7e9bfbd5c8c5', 'north-west'),
        'south-east':_animFrames(id, '0ce49b17-c815-4a55-874e-fac7eee8f762', 'south-east'),
        'north-east':_animFrames(id, '65fdda42-fc88-4975-b632-4688b75868a3', 'north-east'),
      }
    })(),
    // idleFrames: directional stills from Pixellab so sprite faces the right way
    idleFrames: _rotFrames('061aa986-6340-4e23-acc5-a984bfe8ad0c'),
    path: [
      { x: '9%',  y: '12%' },
      { x: '20%', y: '7%'  },
      { x: '24%', y: '24%' },
      { x: '7%',  y: '30%' },
    ],
  },
  {
    id: 'worker-activity',
    src: '/sprites/sprite-activity.png',
    roomId: 'activity',
    w: 120, h: 120, taskIcon: '📊', glowColor: '72,187,255',
    label: 'OPS · ANALYSIS',
    interval: 4600,
    walkFrames: (() => {
      const id = '8b9605dd-3f40-446a-ace1-5aa887c10627'
      return {
        east:        _animFrames(id, '9ce03ed4-e193-49ba-9678-f3fccdfb3239', 'east'),
        north:       _animFrames(id, '96070266-41f6-4fe7-b3bb-89643a152073', 'north'),
        west:        _animFrames(id, '57aabc77-6cea-4173-af7c-a63ca387281d', 'west'),
        'north-west':_animFrames(id, 'a7e4607d-10dd-4545-a7a6-d82777c79314', 'north-west'),
        'south-west':_animFrames(id, '40bdbda5-9e89-46e6-8a0b-f5ac4970f263', 'south-west'),
        'north-east':_animFrames(id, '5a24bb7d-eb02-4c00-879e-3e0b2303f163', 'north-east'),
        'south-east':_animFrames(id, 'b3e7524f-a4e9-4a84-b653-197706a50163', 'south-east'),
        south:       _animFrames(id, '3609add2-994e-4359-b390-5b0b65a632c1', 'south'),
      }
    })(),
    idleFrames: _rotFrames('8b9605dd-3f40-446a-ace1-5aa887c10627'),
    path: [
      { x: '79%', y: '11%' },
      { x: '91%', y: '7%'  },
      { x: '87%', y: '27%' },
      { x: '76%', y: '22%' },
    ],
  },
  {
    id: 'worker-forge',
    src: '/sprites/sprite-forge.png',
    roomId: 'forge',
    w: 120, h: 120, taskIcon: '🎨', glowColor: '255,178,63',
    label: 'FORGE · DESIGN',
    interval: 5600,
    walkFrames: (() => {
      const id = '853c6624-f6f3-4a68-b6b5-a09982ba775e'
      return {
        east:        _animFrames(id, '87fe5f10-95cf-4367-88e4-b8604864bddb', 'east'),
        north:       _animFrames(id, 'bd17aad6-1c0f-414f-95f5-c14d25e3c6c3', 'north'),
        west:        _animFrames(id, '5d119873-26da-434b-8aef-f7853e5254e5', 'west'),
        'north-west':_animFrames(id, '9645ef30-1211-4edb-af40-32b87c52acd9', 'north-west'),
        'north-east':_animFrames(id, 'b9993834-cc15-4a4c-b9d6-26190454e3fa', 'north-east'),
        'south-east':_animFrames(id, '6ec010f6-6505-43fc-95ab-0dff3340c7dc', 'south-east'),
        south:       _animFrames(id, '2d5f8136-d934-4d35-8e42-b6b1ad48b28d', 'south'),
        'south-west':_animFrames(id, '990ec81a-cce2-43d2-b415-01d845bcaff7', 'south-west'),
      }
    })(),
    idleFrames: _rotFrames('853c6624-f6f3-4a68-b6b5-a09982ba775e'),
    path: [
      { x: '11%', y: '68%' },
      { x: '23%', y: '75%' },
      { x: '8%',  y: '85%' },
      { x: '22%', y: '92%' },
    ],
  },
  {
    id: 'worker-archives',
    src: '/sprites/sprite-archives.png',
    roomId: 'archives',
    w: 120, h: 120, taskIcon: '🗄️', glowColor: '255,107,168',
    label: 'VAULT · ARCHIVE',
    interval: 6200,
    walkFrames: (() => {
      const id = '2ac5370e-5abd-4ee9-b955-14ee4d7dc6ab'
      return {
        south:       _animFrames(id, 'ba404a66-32e1-45b6-837c-7bf539ddd886', 'south'),
        east:        _animFrames(id, '64aa7391-6518-4268-a549-bcaad9e138e7', 'east'),
        north:       _animFrames(id, 'dcb9d350-9997-45f2-b18c-993a7779291b', 'north'),
        west:        _animFrames(id, '5d38a378-8521-496c-8e11-3963810d349c', 'west'),
        'south-east':_animFrames(id, 'b917bd6e-ae88-4b28-83f8-1ff650086f53', 'south-east'),
        'north-east':_animFrames(id, 'f6595548-33ba-4d81-b570-22ff6c3c37b2', 'north-east'),
        'north-west':_animFrames(id, '753fed99-6e5b-4d3e-b6b4-6c951e9ea529', 'north-west'),
        'south-west':_animFrames(id, '34a6b0ff-3900-4802-9683-cd92d87797b1', 'south-west'),
      }
    })(),
    idleFrames: _rotFrames('2ac5370e-5abd-4ee9-b955-14ee4d7dc6ab'),
    path: [
      { x: '36%', y: '81%' },
      { x: '50%', y: '88%' },
      { x: '64%', y: '81%' },
    ],
  },
  {
    id: 'worker-treasury',
    src: '/sprites/sprite-treasury.png',
    roomId: 'treasury',
    w: 120, h: 120, taskIcon: '💰', glowColor: '255,214,0',
    label: 'TREASURY · OPS',
    interval: 5000,
    walkFrames: (() => {
      const id = '9779d194-d346-4f4b-8176-5d8a312fd425'
      return {
        south:       _animFrames(id, '58077329-6142-4bef-9469-9ef3a11be4bd', 'south'),
        east:        _animFrames(id, '92cb8e2b-ec70-4137-9ef5-168b4303f7ac', 'east'),
        north:       _animFrames(id, '8474078b-6322-41b3-bd47-a6f14b490cd5', 'north'),
        west:        _animFrames(id, 'cc43e8eb-6746-4f86-a741-ce6b77355bd9', 'west'),
        'south-east':_animFrames(id, '79d80c30-5f94-4aca-ac8e-6406ec901be1', 'south-east'),
        'north-east':_animFrames(id, '52632652-8054-4efd-a1ef-d49681a2a56b', 'north-east'),
        'north-west':_animFrames(id, '58feeee4-d3ab-4a84-add1-3fda48de08f4', 'north-west'),
        'south-west':_animFrames(id, '9b2e67c1-c536-4b97-b566-c27a5c039ec6', 'south-west'),
      }
    })(),
    idleFrames: _rotFrames('9779d194-d346-4f4b-8176-5d8a312fd425'),
    path: [
      { x: '80%', y: '68%' },
      { x: '91%', y: '75%' },
      { x: '83%', y: '88%' },
      { x: '76%', y: '78%' },
    ],
  },
]

// ── Direction detection from movement vector ──────────────────────────────────
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

// ── Walking sprite on map ─────────────────────────────────────────────────────
function MapWalker({ sprite, online }) {
  const [posIdx, setPosIdx]     = useState(0)
  const [walking, setWalking]   = useState(false)
  const [walkDir, setWalkDir]   = useState('south')
  const [frameIdx, setFrameIdx] = useState(0)
  const mountedRef = useRef(true)
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])

  // ── Position movement — advances posIdx on a timer ────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      if (!mountedRef.current) return
      setPosIdx(curr => {
        const next = (curr + 1) % sprite.path.length
        setWalkDir(getWalkDir(sprite.path[curr], sprite.path[next]))
        return next
      })
      setWalking(true)
      setFrameIdx(0) // reset frame at each new move
      setTimeout(() => { if (mountedRef.current) setWalking(false) }, MOVE_MS - 500)
    }, sprite.interval)
    return () => clearInterval(id)
  }, [sprite.interval, sprite.path])

  // ── Frame cycling — runs at game speed (150ms walk, 400ms idle) ───────────
  useEffect(() => {
    const dirFrames = walking
      ? (sprite.walkFrames?.[walkDir] ?? sprite.walkFrames?.south ?? [])
      : (sprite.idleFrames?.[walkDir] ?? sprite.idleFrames?.south ?? [])
    if (!dirFrames.length) return
    const delay = walking ? 140 : 380
    const id = setInterval(() => {
      if (!mountedRef.current) return
      setFrameIdx(i => (i + 1) % dirFrames.length)
    }, delay)
    return () => clearInterval(id)
  }, [walking, walkDir, sprite.walkFrames, sprite.idleFrames])

  const pos = sprite.path[posIdx]
  const gc  = sprite.glowColor

  // Current sprite source — animated frame or directional still or fallback
  const dirFrames = walking
    ? (sprite.walkFrames?.[walkDir] ?? sprite.walkFrames?.south ?? [])
    : (sprite.idleFrames?.[walkDir] ?? sprite.idleFrames?.south ?? [])
  const currentSrc = dirFrames.length ? dirFrames[frameIdx % dirFrames.length] : sprite.src

  return (
    <div style={{
      position: 'absolute', left: pos.x, top: pos.y,
      transform: 'translate(-50%, -50%)',
      zIndex: 5, pointerEvents: 'none',
      transition: `left ${MOVE_MS}ms cubic-bezier(0.45,0,0.55,1), top ${MOVE_MS}ms cubic-bezier(0.45,0,0.55,1)`,
    }}>
      {/* Agent label — shows when idle */}
      <div style={{
        position: 'absolute', bottom: '100%', left: '50%',
        transform: 'translateX(-50%)',
        whiteSpace: 'nowrap', marginBottom: 4,
        opacity: walking ? 0 : 1, transition: 'opacity 0.5s',
        background: 'rgba(2,3,8,0.88)',
        border: `1px solid rgba(${gc},0.6)`,
        borderRadius: 3, padding: '2px 7px',
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        <span style={{ fontSize: 11 }}>{sprite.taskIcon}</span>
        <span style={{
          fontSize: 7, fontFamily: 'var(--font-mono)', fontWeight: 700,
          color: `rgb(${gc})`, letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>{sprite.label}</span>
        {online && (
          <span style={{
            width: 4, height: 4, borderRadius: '50%',
            background: `rgb(${gc})`, boxShadow: `0 0 5px rgb(${gc})`,
            animation: 'led-blink 1.2s ease-in-out infinite', display: 'inline-block',
          }} />
        )}
      </div>

      {/* Responsive sprite container — viewport-scaled, shadow inside so it tracks */}
      <div style={{
        width: SPRITE_DISPLAY, height: SPRITE_DISPLAY,
        flexShrink: 0, position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {/* Shadow pool — inherits container size so it scales automatically */}
        <div style={{
          position: 'absolute', bottom: -4, left: '50%',
          transform: 'translateX(-50%)',
          width: '140%', height: 12,
          background: `radial-gradient(ellipse, rgba(${gc},0.45) 0%, transparent 70%)`,
          borderRadius: '50%', animation: 'sprite-pulse 2s ease-in-out infinite',
        }} />
        <img
          src={currentSrc}
          alt="" draggable={false}
          style={{
            width: '100%', height: '100%',
            objectFit: 'contain',
            imageRendering: 'pixelated', display: 'block',
            filter: online
              ? `drop-shadow(0 0 6px rgba(${gc},0.8)) drop-shadow(0 2px 8px rgba(${gc},0.4))`
              : `drop-shadow(0 0 3px rgba(${gc},0.3)) brightness(0.75)`,
          }}
          onError={e => { e.currentTarget.style.visibility = 'hidden' }}
        />
      </div>
    </div>
  )
}

// ── ELLIE boss sprite — center of map ─────────────────────────────────────────
function EllieOnMap() {
  return (
    <div style={{
      position: 'absolute', left: '50%', top: '47%',
      transform: 'translate(-50%, -50%)',
      zIndex: 6, pointerEvents: 'none',
      animation: 'map-float 3.5s ease-in-out infinite',
    }}>
      {/* Wide outer glow */}
      <div style={{
        position: 'absolute', bottom: -20, left: '50%',
        transform: 'translateX(-50%)',
        width: 260, height: 80,
        background: 'radial-gradient(ellipse, rgba(155,114,255,0.6) 0%, transparent 70%)',
        animation: 'ellie-pulse 2.4s ease-in-out infinite',
        borderRadius: '50%',
      }} />
      {/* ELLIE name plate */}
      <div style={{
        position: 'absolute', top: -28, left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(2,2,10,0.92)',
        border: '1px solid rgba(155,114,255,0.7)',
        borderRadius: 3, padding: '3px 12px',
        whiteSpace: 'nowrap',
        boxShadow: '0 0 16px rgba(155,114,255,0.4)',
      }}>
        <span style={{
          fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
          color: '#9B72FF', letterSpacing: '0.2em', textTransform: 'uppercase',
        }}>⬡ ELLIE · LEADER AI · OPERATIONAL</span>
      </div>
      <img
        src="/sprites/EllieSprite/angular_menacing_white_chrome_body_with_dark_biome/rotations/south.png"
        alt="ELLIE"
        draggable={false}
        style={{
          width: 'clamp(220px, 26vw, 360px)',
          height: 'clamp(220px, 26vw, 360px)',
          objectFit: 'contain',
          imageRendering: 'pixelated', position: 'relative', zIndex: 1, display: 'block',
          filter: 'drop-shadow(0 0 20px rgba(155,114,255,0.9)) drop-shadow(0 0 40px rgba(155,114,255,0.4))',
        }}
      />
    </div>
  )
}

// ── Room live-data mini panel ─────────────────────────────────────────────────
function RoomLiveOverlay({ left, top, accent, accentRgb, label, value, sub, blink }) {
  return (
    <div style={{
      position: 'absolute', left, top,
      zIndex: 4, pointerEvents: 'none',
      background: 'rgba(2,3,8,0.9)',
      border: `1px solid rgba(${accentRgb},0.55)`,
      borderRadius: 3, padding: '5px 9px',
      backdropFilter: 'blur(6px)',
      minWidth: 72,
      boxShadow: `0 0 18px rgba(${accentRgb},0.25)`,
      animation: 'module-boot 0.4s ease-out both',
    }}>
      <div style={{ fontSize: 7, fontFamily: 'var(--font-mono)', color: `rgba(${accentRgb},0.65)`, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 15, fontFamily: 'var(--font-mono)', fontWeight: 700, color: accent, lineHeight: 1.1 }}>{value}</div>
      {sub && (
        <div style={{
          fontSize: 7, fontFamily: 'var(--font-mono)', color: accent, opacity: 0.65,
          marginTop: 3, animation: blink ? 'led-blink 0.9s ease-in-out infinite' : 'none',
        }}>{sub}</div>
      )}
    </div>
  )
}

function stageFromPipeline(pipeline, queue, publishProgress) {
  if (publishProgress?.running) return 3
  if (!pipeline) return queue.length > 0 ? 2 : -1
  if (!pipeline.running && pipeline.step !== 'done' && pipeline.step !== 'error') return queue.length > 0 ? 2 : -1
  const s = pipeline.step
  if (s === 'researching') return 0
  if (FORGE_STEPS.has(s) || s === 'starting') return 1
  if (s === 'done' || s === 'notifying') return queue.length > 0 ? 2 : 3
  return -1
}

function PipelineBar({ pipeline, queue, publishProgress }) {
  const active = stageFromPipeline(pipeline, queue, publishProgress)
  const isRunning = pipeline?.running || publishProgress?.running
  const hasError = pipeline?.step === 'error'
  const pct = pipeline?.pct ?? 0

  const STAGE_COLORS = ['#FF00CC', '#00EEFF', '#00FF88', '#FFE600']
  const nodeColor = (i) => {
    if (hasError && i === active) return '#FF3060'
    if (i < active) return '#00FF88'
    if (i === active && isRunning) return STAGE_COLORS[i]
    if (i === active) return '#00FF88'
    return 'rgba(65,58,90,0.45)'
  }
  const lineActive = (i) => i < active

  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '7px 24px',
      background: 'rgba(2,3,10,0.99)',
      borderBottom: '1px solid rgba(255,220,0,0.1)',
      flexShrink: 0, gap: 0,
      backgroundImage: 'repeating-linear-gradient(transparent 0px,transparent 3px,rgba(0,0,0,0.1) 3px,rgba(0,0,0,0.1) 4px)',
      backgroundSize: '100% 4px',
      boxShadow: '0 2px 20px rgba(0,0,0,0.8)',
    }}>

      {/* HUD label */}
      <div style={{ display: 'flex', flexDirection: 'column', marginRight: 22, flexShrink: 0, gap: 1 }}>
        <span style={{ fontSize: 5, fontFamily: 'var(--font-pixel)', color: 'rgba(255,220,0,0.22)', letterSpacing: '0.3em', textTransform: 'uppercase' }}>◈</span>
        <span style={{ fontSize: 6, fontFamily: 'var(--font-pixel)', color: 'rgba(255,220,0,0.32)', letterSpacing: '0.18em', textTransform: 'uppercase', whiteSpace: 'nowrap', lineHeight: 1.6 }}>FLOOR</span>
        <span style={{ fontSize: 6, fontFamily: 'var(--font-pixel)', color: 'rgba(255,220,0,0.32)', letterSpacing: '0.18em', textTransform: 'uppercase', whiteSpace: 'nowrap', lineHeight: 1.6 }}>STATUS</span>
      </div>

      {PIPELINE_STAGES.map((stage, i) => (
        <div key={stage} style={{ display: 'flex', alignItems: 'center', flex: i < PIPELINE_STAGES.length - 1 ? 1 : 'none' }}>

          {/* Stage node block */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            padding: '3px 12px',
            background: i === active
              ? `color-mix(in srgb, ${nodeColor(i)} 10%, rgba(1,3,12,0.95))`
              : 'transparent',
            border: i === active ? `1px solid color-mix(in srgb, ${nodeColor(i)} 55%, transparent)` : '1px solid transparent',
            boxShadow: i === active && isRunning
              ? `0 0 24px color-mix(in srgb, ${nodeColor(i)} 55%, transparent), 0 0 48px color-mix(in srgb, ${nodeColor(i)} 20%, transparent)`
              : 'none',
            transition: 'all 0.35s',
          }}>
            {/* Diamond node + ring burst */}
            <div style={{ position: 'relative', width: 18, height: 18, flexShrink: 0 }}>
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%) rotate(45deg)',
                width: i === active ? 11 : 7,
                height: i === active ? 11 : 7,
                background: nodeColor(i),
                boxShadow: (i === active || i < active)
                  ? `0 0 8px ${nodeColor(i)}, 0 0 18px color-mix(in srgb, ${nodeColor(i)} 45%, transparent)`
                  : 'none',
                animation: i === active && isRunning ? 'led-blink 1.2s ease-in-out infinite' : 'none',
                transition: 'all 0.3s',
              }} />
              {i === active && isRunning && (
                <div style={{
                  position: 'absolute', top: '50%', left: '50%',
                  width: 18, height: 18, borderRadius: '50%',
                  border: `1px solid ${nodeColor(i)}`,
                  animation: 'node-ring-burst 1.5s ease-out infinite',
                  pointerEvents: 'none',
                }} />
              )}
            </div>
            <span style={{
              fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
              color: nodeColor(i), textTransform: 'uppercase', letterSpacing: '0.07em',
              opacity: i === active ? 1 : i < active ? 0.7 : 0.35,
              transition: 'color 0.3s, opacity 0.3s',
              whiteSpace: 'nowrap',
            }}>{stage}</span>
            {i === active && isRunning && (
              <span style={{ fontSize: 7, color: STAGE_COLORS[i], fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>{pct}%</span>
            )}
          </div>

          {/* Connecting line */}
          {i < PIPELINE_STAGES.length - 1 && (
            <div style={{
              flex: 1, height: 2, position: 'relative', overflow: 'hidden',
              background: lineActive(i)
                ? `linear-gradient(90deg, ${nodeColor(i)}, rgba(0,255,136,0.4))`
                : 'rgba(45,40,65,0.45)',
              boxShadow: lineActive(i) ? '0 0 7px rgba(0,255,136,0.55)' : 'none',
              transition: 'background 0.45s, box-shadow 0.45s',
            }}>
              {(i === active - 1 || (i === active && isRunning)) && (
                <div style={{
                  position: 'absolute', top: 0, left: 0,
                  width: 32, height: '100%',
                  background: `linear-gradient(90deg, transparent, ${STAGE_COLORS[Math.min(i + 1, 3)]}, transparent)`,
                  boxShadow: `0 0 10px ${STAGE_COLORS[Math.min(i + 1, 3)]}`,
                  animation: 'corridor-flow 2s ease-in-out infinite',
                }} />
              )}
            </div>
          )}
        </div>
      ))}

      {/* Status readout */}
      <div style={{
        marginLeft: 20, fontSize: 9, fontFamily: 'var(--font-mono)',
        color: hasError ? '#FF3060' : isRunning ? '#FF00CC' : active >= 0 ? '#00FF88' : 'rgba(110,100,150,0.38)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260,
        textTransform: 'uppercase', letterSpacing: '0.06em',
        animation: isRunning ? 'led-blink 2.2s ease-in-out infinite' : 'none',
      }}>
        {hasError
          ? `✕ ${pipeline.detail}`
          : isRunning
            ? `⟳ ${pipeline?.detail || publishProgress?.design_name || 'running…'}`
            : active >= 0
              ? `✓ ${PIPELINE_STAGES[active]}${active === 2 && queue.length > 0 ? ` — ${queue.length} pending` : ''}`
              : '— standby —'
        }
      </div>
    </div>
  )
}

// ── ELLIE supervisor room ─────────────────────────────────────────────────────
function StrategyReport({ report, onRunProposal, onDismiss }) {
  const scoreColor = s => s >= 0.8 ? 'var(--mint-500)' : s >= 0.6 ? 'var(--gold-500, #f59e0b)' : 'var(--ink-400)'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--mint-500)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Strategy Report
          </div>
          <div style={{ fontSize: 10, color: 'var(--ink-500)', marginTop: 2 }}>
            {report.niches_analyzed > 0
              ? `Based on ${report.niches_analyzed} Nova trend reports`
              : 'No Nova research data available — run Nova first for better analysis'}
          </div>
        </div>
        <Btn onClick={onDismiss} color="var(--ink-400)" small>✕</Btn>
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-700)', lineHeight: 1.5 }}>{report.summary}</div>

      {report.top_niches?.length > 0 && (
        <div>
          <Label>Top Niches</Label>
          {report.top_niches.map((n, i) => (
            <div key={i} style={{ background: 'var(--paper-100)', borderRadius: 'var(--radius-sm)',
              padding: '8px 10px', marginBottom: 5, borderLeft: `3px solid ${scoreColor(n.opportunity_score)}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-800)' }}>{n.niche}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: scoreColor(n.opportunity_score) }}>
                  {Math.round((n.opportunity_score || 0) * 100)}%
                </span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--ink-500)', marginBottom: 5, lineHeight: 1.4 }}>{n.reasoning}</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {n.best_products?.map(p => (
                  <span key={p} style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                    background: 'rgba(122,110,142,0.12)', color: 'var(--violet-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {p}
                  </span>
                ))}
                {n.recommended_action && (
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99, marginLeft: 'auto',
                    background: n.recommended_action === 'run Forge' ? 'rgba(94,234,212,0.15)' : 'rgba(0,0,0,0.05)',
                    color: n.recommended_action === 'run Forge' ? 'var(--mint-500)' : 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {n.recommended_action}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {report.catalog_gaps?.length > 0 && (
        <div>
          <Label>Catalog Gaps</Label>
          {report.catalog_gaps.map((g, i) => (
            <div key={i} style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.3)',
              borderRadius: 'var(--radius-sm)', padding: '7px 10px', marginBottom: 5 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-700)', marginBottom: 2 }}>
                ⚠ {g.product_type}
                <span style={{ marginLeft: 8, fontSize: 9, padding: '1px 6px', borderRadius: 99,
                  background: g.estimated_opportunity === 'high' ? 'rgba(251,191,36,0.2)' : 'rgba(0,0,0,0.06)',
                  color: g.estimated_opportunity === 'high' ? '#b45309' : 'var(--ink-400)', fontWeight: 700, textTransform: 'uppercase' }}>
                  {g.estimated_opportunity}
                </span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--ink-500)', lineHeight: 1.4 }}>{g.why_it_matters}</div>
              {g.blueprint_note && (
                <div style={{ fontSize: 9, color: 'var(--ink-400)', marginTop: 3, fontStyle: 'italic' }}>{g.blueprint_note}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {report.proposed_runs?.length > 0 && (
        <div>
          <Label>Proposed Forge Runs</Label>
          {report.proposed_runs.map((r, i) => (
            <div key={i} style={{ background: 'rgba(122,110,142,0.06)', border: '1px solid var(--paper-300)',
              borderRadius: 'var(--radius-sm)', padding: '8px 10px', marginBottom: 5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-800)', marginBottom: 2 }}>{r.niche}</div>
                  <div style={{ fontSize: 10, color: 'var(--ink-500)', marginBottom: 4 }}>{r.rationale}</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {r.products?.map(p => (
                      <span key={p} style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                        background: 'rgba(122,110,142,0.12)', color: 'var(--violet-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
                <Btn onClick={() => onRunProposal(r)} color="var(--violet-500)" small>Run</Btn>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ExploreReport({ discovery, onDesign, onDismiss }) {
  const opps = discovery?.opportunities || []
  const scoreColor = s => s >= 0.7 ? 'var(--mint-500)' : s >= 0.4 ? 'var(--amber-500)' : 'var(--ink-400)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--amber-500)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Trend Discovery
          </div>
          <div style={{ fontSize: 10, color: 'var(--ink-500)', marginTop: 2 }}>
            {opps.length > 0
              ? `${opps.length} fresh niches from live Etsy research — top opportunities first`
              : (discovery?.error || 'No opportunities found')}
          </div>
        </div>
        <Btn onClick={onDismiss} color="var(--ink-400)" small>✕</Btn>
      </div>

      {opps.map((opp, i) => (
        <div key={i} style={{
          background: 'var(--paper-100)',
          border: `1.5px solid ${i === 0 ? 'var(--amber-500)' : 'var(--paper-300)'}`,
          borderRadius: 'var(--radius-md)',
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink-900)' }}>
              {i === 0 && <span style={{ color: 'var(--amber-500)', marginRight: 5 }}>★</span>}
              {opp.niche}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, color: scoreColor(opp.opportunity_score), fontFamily: 'var(--font-mono)' }}>
              {Math.round((opp.opportunity_score || 0) * 100)}%
            </span>
          </div>

          <div style={{ fontSize: 11, color: 'var(--ink-700)', lineHeight: 1.4 }}>{opp.opportunity}</div>

          {opp.price_range?.sweet_spot && (
            <div style={{ fontSize: 10, color: 'var(--ink-500)' }}>
              Sweet spot: <strong style={{ color: 'var(--ink-700)' }}>${opp.price_range.sweet_spot}</strong>
              {opp.price_range.low && opp.price_range.high && ` (range $${opp.price_range.low}–$${opp.price_range.high})`}
            </div>
          )}

          {opp.concepts?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {opp.concepts.map((c, j) => (
                <div key={j} style={{ fontSize: 10, color: 'var(--ink-600)', display: 'flex', gap: 5 }}>
                  <span style={{ color: 'var(--amber-500)' }}>·</span>{c}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', marginTop: 2 }}>
            {opp.recommended_products?.map(p => (
              <span key={p} style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                background: 'rgba(122,110,142,0.12)', color: 'var(--violet-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {p}
              </span>
            ))}
            {opp.top_tags?.slice(0, 3).map(t => (
              <span key={t} style={{ fontSize: 9, padding: '2px 7px', borderRadius: 99,
                background: 'rgba(0,0,0,0.05)', color: 'var(--ink-400)', textTransform: 'lowercase' }}>
                #{t}
              </span>
            ))}
            <div style={{ marginLeft: 'auto' }}>
              <Btn onClick={() => onDesign(opp)} color="var(--violet-500)" small>→ Design This</Btn>
            </div>
          </div>

          {opp.avoid && (
            <div style={{ fontSize: 9, color: 'var(--coral-500)', fontStyle: 'italic', lineHeight: 1.4 }}>
              Avoid: {opp.avoid}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function EllieRoom({ status, activity, onRefresh, onStatusUpdate, onRunNova, onRunForge, onPublishAll }) {
  const agentStatus = status?.agents?.find(a => a.name === 'ELLIE')?.status ?? 'idle'
  const spend = status?.metrics?.find(m => m.label === 'Spend today')?.value ?? '—'

  const [cmd, setCmd] = useState('')
  const [thinking, setThinking] = useState(false)
  const [plan, setPlan] = useState(null)
  const [strategyReport, setStrategyReport] = useState(null)
  const [exploreReport, setExploreReport] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [pipeline, setPipeline] = useState(null)
  const pollRef = useRef(null)

  const stopPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }

  const startPipelinePoll = () => {
    stopPoll()
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get('/business/ellie/pipeline')
        const p = res.data
        setPipeline(p)
        onStatusUpdate?.({ thinking: false, plan: null, strategyReport: null, pipeline: p })
        if (!p.running) {
          stopPoll()
          if (p.step === 'done') onRefresh()
        }
      } catch { stopPoll() }
    }, 2000)
  }

  useEffect(() => () => stopPoll(), [])

  const sendCommand = async () => {
    if (!cmd.trim()) return
    setThinking(true)
    setPlan(null)
    setStrategyReport(null)
    setExploreReport(null)
    onStatusUpdate?.({ thinking: true, plan: null, strategyReport: null, exploreReport: null, pipeline: null })
    try {
      const res = await api.post('/business/ellie/command', { message: cmd })
      const data = res.data
      if (data.command_type === 'strategy') {
        setStrategyReport(data.report)
        onStatusUpdate?.({ thinking: false, plan: null, strategyReport: data.report, exploreReport: null, pipeline: null })
      } else if (data.command_type === 'explore') {
        setExploreReport(data.discovery)
        onStatusUpdate?.({ thinking: false, plan: null, strategyReport: null, exploreReport: data.discovery, pipeline: null })
      } else {
        // both 'design' and 'repurpose' return a plan object
        setPlan(data.plan)
        onStatusUpdate?.({ thinking: false, plan: data.plan, strategyReport: null, exploreReport: null, pipeline: null })
      }
    } catch (e) {
      setPlan({ error: 'Failed to reach ELLIE' })
      onStatusUpdate?.({ thinking: false, plan: null, strategyReport: null, exploreReport: null, pipeline: null })
    }
    setThinking(false)
  }

  const confirmPlan = async (planToRun) => {
    const p = planToRun || plan
    setConfirming(true)
    try {
      await api.post('/business/ellie/confirm', { plan: p })
      const pipelineState = { running: true, step: 'starting', detail: 'ELLIE is spinning up the pipeline…', pct: 0 }
      setPipeline(pipelineState)
      onStatusUpdate?.({ thinking: false, plan: null, strategyReport: null, exploreReport: null, pipeline: pipelineState })
      startPipelinePoll()
      setPlan(null)
      setStrategyReport(null)
      setExploreReport(null)
      setCmd('')
    } catch { }
    setConfirming(false)
  }

  const runProposal = (proposal) => {
    // Convert a proposed_run from the strategy report into a pipeline plan
    const syntheticPlan = {
      command_type: 'design',
      understood_intent: `Run Forge for: ${proposal.niche}`,
      interpretation: proposal.rationale,
      niches: [{
        name: proposal.niche,
        description: proposal.niche,
        suggested_products: proposal.products,
        n_concepts: proposal.n_concepts || 3,
        style_notes: '',
      }],
      market_reasoning: proposal.rationale,
    }
    confirmPlan(syntheticPlan)
  }

  const pipelineActive = pipeline && (pipeline.running || pipeline.step === 'done' || pipeline.step === 'error')

  return (
    <Room icon="🧠" name="ELLIE" accent="var(--violet-500)" status={thinking || pipeline?.running ? 'online' : agentStatus}
      style={{ gridArea: 'ellie' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>

        {/* Spend */}
        <div style={{ fontSize: 11, color: 'var(--ink-500)', textAlign: 'center' }}>
          Spend today: <strong style={{ color: 'var(--ink-800)' }}>{spend}</strong>
        </div>

        {/* Pipeline progress */}
        {pipelineActive && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                color: pipeline.step === 'error' ? 'var(--coral-500)' : pipeline.step === 'done' ? 'var(--mint-500)' : 'var(--violet-500)' }}>
                {pipeline.step === 'done' ? '✓ Done' : pipeline.step === 'error' ? '✕ Error' : `⚙ ${pipeline.step}`}
              </span>
              <span style={{ fontSize: 10, color: 'var(--ink-400)', fontFamily: 'var(--font-mono)' }}>{pipeline.pct}%</span>
            </div>
            <div style={{ height: 5, background: 'var(--paper-200)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pipeline.pct}%`, borderRadius: 99, transition: 'width 0.4s ease',
                background: pipeline.step === 'error' ? 'var(--coral-500)' : pipeline.step === 'done' ? 'var(--mint-500)' : 'var(--violet-500)' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-700)', lineHeight: 1.4 }}>{pipeline.detail}</div>
          </div>
        )}

        {/* Strategy report */}
        {strategyReport && (
          <StrategyReport
            report={strategyReport}
            onRunProposal={runProposal}
            onDismiss={() => setStrategyReport(null)}
          />
        )}

        {/* Explore / trend discovery report */}
        {exploreReport && (
          <ExploreReport
            discovery={exploreReport}
            onDesign={(opp) => {
              const syntheticPlan = {
                command_type: 'design',
                understood_intent: `Design for: ${opp.niche}`,
                interpretation: opp.opportunity,
                niches: [{
                  name: opp.niche,
                  description: opp.opportunity || opp.niche,
                  suggested_products: opp.recommended_products?.length ? opp.recommended_products : ['t-shirt', 'mug', 'tote bag'],
                  n_concepts: 3,
                  style_notes: opp.style_themes?.join(', ') || '',
                }],
                market_reasoning: opp.opportunity,
              }
              setExploreReport(null)
              setPlan(syntheticPlan)
            }}
            onDismiss={() => setExploreReport(null)}
          />
        )}

        {/* Plan confirmation card */}
        {plan && !plan.error && (
          <div style={{ background: 'rgba(122,110,142,0.07)', border: '1.5px solid var(--violet-500)',
            borderRadius: 'var(--radius-md)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--violet-500)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {plan.command_type === 'repurpose' ? '♻ Repurpose Plan' : "ELLIE's Plan"}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-800)', fontWeight: 600, lineHeight: 1.4 }}>
              {plan.understood_intent}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-700)', lineHeight: 1.5 }}>
              {plan.interpretation}
            </div>

            {/* Repurpose: show target products + design list */}
            {plan.command_type === 'repurpose' && plan.new_products?.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-600)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
                  New Products
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {plan.new_products.map(p => (
                    <span key={p} style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                      background: 'rgba(94,234,212,0.12)', color: 'var(--mint-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {plan.command_type === 'repurpose' && plan.designs?.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-600)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
                  Designs to Repurpose ({plan.designs.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {plan.designs.slice(0, 6).map((d, i) => (
                    <div key={i} style={{ fontSize: 10, color: 'var(--ink-700)', display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ color: 'var(--ink-400)' }}>·</span>
                      <span style={{ fontWeight: 600 }}>{d.concept_name || d.name}</span>
                      <span style={{ color: 'var(--ink-400)' }}>{d.niche}</span>
                    </div>
                  ))}
                  {plan.designs.length > 6 && (
                    <div style={{ fontSize: 10, color: 'var(--ink-400)', fontStyle: 'italic' }}>
                      …and {plan.designs.length - 6} more
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Design plan: niche breakdown */}
            {plan.command_type !== 'repurpose' && plan.niches?.map((n, i) => (
              <div key={i} style={{ background: 'var(--paper-100)', borderRadius: 'var(--radius-sm)', padding: '8px 10px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-800)', marginBottom: 3 }}>{n.name}</div>
                <div style={{ fontSize: 10, color: 'var(--ink-500)', marginBottom: 4 }}>{n.description}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {n.suggested_products?.map(p => (
                    <span key={p} style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                      background: 'rgba(122,110,142,0.12)', color: 'var(--violet-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {plan.market_reasoning && (
              <div style={{ fontSize: 10, color: 'var(--ink-400)', fontStyle: 'italic', lineHeight: 1.4 }}>
                {plan.market_reasoning}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <Btn onClick={() => confirmPlan()} disabled={confirming || (plan.command_type === 'repurpose' && !plan.designs?.length)} color="var(--violet-500)">
                {confirming ? '⏳ Starting…' : plan.command_type === 'repurpose' ? '♻ Repurpose' : '✓ Run it'}
              </Btn>
              <Btn onClick={() => setPlan(null)} color="var(--ink-400)">✕ Cancel</Btn>
            </div>
          </div>
        )}
        {plan?.error && (
          <div style={{ fontSize: 11, color: 'var(--coral-500)' }}>{plan.error}</div>
        )}

        {/* Manual controls */}
        <div style={{ borderTop: '1px solid var(--paper-200)', paddingTop: 10, marginTop: 'auto' }}>
          <Label>Manual Controls</Label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Btn onClick={onRunNova} disabled={pipeline?.running} color="var(--mint-500)" small>▶ Run Nova</Btn>
            <Btn onClick={onRunForge} disabled={pipeline?.running} color="var(--amber-500)" small>▶ Run Forge</Btn>
            <Btn onClick={onPublishAll} disabled={pipeline?.running} color="var(--violet-500)" small>✓ Publish All</Btn>
          </div>
        </div>

        {/* Command input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label>Tell ELLIE what to do</Label>
          <textarea
            value={cmd}
            onChange={e => setCmd(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendCommand() } }}
            placeholder="e.g. make hiking designs for mugs… or: what's trending right now? or: reuse my designs as canvases"
            rows={2}
            disabled={thinking || pipeline?.running}
            style={{ width: '100%', resize: 'none', padding: '8px 10px',
              border: '1px solid var(--ink-300)', borderRadius: 'var(--radius-sm)',
              background: 'var(--paper-100)', color: 'var(--ink-900)',
              fontFamily: 'var(--font-ui)', fontSize: 12 }}
          />
          <Btn onClick={sendCommand} disabled={thinking || !cmd.trim() || pipeline?.running} color="var(--violet-500)">
            {thinking ? '⏳ Thinking…' : '→ Send'}
          </Btn>
        </div>
      </div>
    </Room>
  )
}

// ── FORGE design room ─────────────────────────────────────────────────────────
const FORGE_PRESETS = [
  { label: 'Etsy Profile',  prompt: 'Etsy shop profile picture — minimalist mountain adventure logo, square, bold clean lines', n: 3 },
  { label: 'Shop Banner',   prompt: 'Etsy shop banner — wide minimalist mountain landscape, sunrise gradient, atmospheric', n: 3 },
  { label: 'Mug Design',    prompt: 'minimalist mountain coffee mug print design, clean typography, earthy tones', n: 5 },
  { label: 'Tee Design',    prompt: 'vintage adventure t-shirt graphic, mountain silhouette, retro sun badge', n: 5 },
  { label: 'Logo Concept',  prompt: 'minimal outdoor brand logo concept, mountain peak, simple geometric', n: 3 },
]

function ForgeRoom({ queue, onRun, onVerdict, onRefresh, paused }) {
  const [niche, setNiche] = useState('')
  const [nConcepts, setNConcepts] = useState(5)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(null)
  const pollRef = useRef(null)

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  const startPolling = () => {
    stopPolling()
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get('/business/forge/progress')
        const p = res.data
        setProgress(p)
        if (!p.running) {
          stopPolling()
          setRunning(false)
          if (p.step === 'done') onRefresh()
        }
      } catch { stopPolling(); setRunning(false) }
    }, 1500)
  }

  useEffect(() => () => stopPolling(), [])

  const agentStatus = running ? 'online' : queue.length > 0 ? 'online' : 'idle'

  const handleRun = async () => {
    if (!niche.trim()) return
    setRunning(true)
    setProgress({ running: true, step: 'starting', detail: 'Kicking off Forge…', pct: 0 })
    await onRun(niche.trim(), nConcepts)
    startPolling()
  }

  const applyPreset = (p) => {
    setNiche(p.prompt)
    setNConcepts(p.n)
  }

  return (
    <Room icon="🔨" name="Forge · Design Room" accent="var(--amber-500)" status={running ? 'online' : agentStatus}
      style={{ gridArea: 'forge' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Etsy branding presets */}
        <div>
          <Label>Quick Presets</Label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {FORGE_PRESETS.map(p => (
              <button key={p.label} onClick={() => applyPreset(p)} style={{
                background: niche === p.prompt ? 'rgba(255,178,63,0.2)' : 'var(--paper-100)',
                border: `1px solid ${niche === p.prompt ? 'var(--amber-500)' : 'var(--ink-300)'}`,
                borderRadius: 'var(--radius-sm)',
                color: niche === p.prompt ? 'var(--amber-500)' : 'var(--ink-600)',
                fontFamily: 'var(--font-ui)',
                fontWeight: 600,
                fontSize: 11,
                padding: '5px 11px',
                cursor: 'pointer',
              }}>{p.label}</button>
            ))}
          </div>
        </div>

        {/* Trigger controls */}
        <div>
          <Label>Custom Prompt</Label>
          <textarea
            value={niche}
            onChange={e => setNiche(e.target.value)}
            placeholder="describe what to design..."
            rows={2}
            style={{
              width: '100%', resize: 'none', padding: '8px 10px',
              border: '1px solid var(--ink-300)', borderRadius: 'var(--radius-sm)',
              background: 'var(--paper-100)', color: 'var(--ink-900)',
              fontFamily: 'var(--font-ui)', fontSize: 12, marginBottom: 8,
            }}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {[1, 3, 5].map(n => (
                <button key={n} onClick={() => setNConcepts(n)} style={{
                  background: nConcepts === n ? 'rgba(255,178,63,0.2)' : 'var(--paper-100)',
                  border: `1px solid ${nConcepts === n ? 'var(--amber-500)' : 'var(--ink-300)'}`,
                  borderRadius: 'var(--radius-sm)',
                  color: nConcepts === n ? 'var(--amber-500)' : 'var(--ink-500)',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700, fontSize: 12,
                  padding: '5px 10px', cursor: 'pointer',
                }}>{n}</button>
              ))}
              <span style={{ fontSize: 11, color: 'var(--ink-400)', alignSelf: 'center', marginLeft: 4 }}>concepts</span>
            </div>
            <Btn onClick={handleRun} disabled={running || paused || !niche.trim()} color="var(--amber-500)">
              {running ? '⏳ Running…' : '▶ Run Forge'}
            </Btn>
          </div>
        </div>

        {/* Progress bar */}
        {progress && (progress.running || progress.step === 'done' || progress.step === 'error') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: progress.step === 'error' ? 'var(--coral-500)' : 'var(--amber-500)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {progress.step === 'done' ? '✓ Done' : progress.step === 'error' ? '✕ Error' : `⚙ ${progress.step}`}
              </span>
              <span style={{ fontSize: 11, color: 'var(--ink-400)', fontFamily: 'var(--font-mono)' }}>{progress.pct}%</span>
            </div>
            <div style={{ height: 6, background: 'var(--paper-200)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${progress.pct}%`,
                background: progress.step === 'error' ? 'var(--coral-500)' : progress.step === 'done' ? 'var(--mint-500)' : 'var(--amber-500)',
                borderRadius: 99,
                transition: 'width 0.4s ease',
              }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-700)', lineHeight: 1.4 }}>{progress.detail}</div>
          </div>
        )}

        {/* Design queue */}
        <div>
          <Label>Design Queue {queue.length > 0 ? `(${queue.length})` : ''}</Label>
          {queue.length === 0
            ? <Empty>No designs in queue — run Forge to generate</Empty>
            : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
                {queue.slice(0, 12).map(d => (
                  <div key={d.id} style={{
                    background: 'var(--paper-100)', border: '1px solid var(--paper-200)',
                    borderRadius: 'var(--radius-md)', overflow: 'hidden',
                  }}>
                    {d.image_url
                      ? <img src={d.image_url} alt={d.concept_name} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover' }} />
                      : (
                        <div style={{ width: '100%', aspectRatio: '1', background: 'var(--paper-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🎨</div>
                      )
                    }
                    <div style={{ padding: '6px 8px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-700)', marginBottom: 4, lineHeight: 1.3 }}>{d.concept_name}</div>
                      <div style={{ fontSize: 10, color: 'var(--ink-400)', marginBottom: 6 }}>score {((d.forge_score ?? 0) * 100).toFixed(0)}%</div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => onVerdict(d.id, 'approve')} title="Approve" style={tinyBtn('var(--mint-500)')}>✓</button>
                        <button onClick={() => onVerdict(d.id, 'iterate')} title="Iterate" style={tinyBtn('var(--amber-500)')}>↻</button>
                        <button onClick={() => onVerdict(d.id, 'reject')} title="Reject" style={tinyBtn('var(--coral-500)')}>✕</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      </div>
    </Room>
  )
}

function tinyBtn(color) {
  return {
    flex: 1, padding: '3px 0', background: 'transparent',
    border: `1px solid ${color}`, borderRadius: 6,
    color, fontWeight: 700, fontSize: 11, cursor: 'pointer',
  }
}

// ── NOVA research room ────────────────────────────────────────────────────────
function NovaRoom({ trends, onRun }) {
  const [running, setRunning] = useState(false)
  const recent = trends?.trends?.slice(0, 5) ?? []

  const handleRun = async () => {
    setRunning(true)
    await onRun()
    setTimeout(() => setRunning(false), 3000)
  }

  return (
    <Room icon="🔭" name="Nova · Research" accent="var(--mint-500)"
      status={running ? 'online' : recent.length > 0 ? 'online' : 'idle'}>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Btn onClick={handleRun} disabled={running} color="var(--mint-500)">
          {running ? '⏳ Researching…' : '▶ Run Nova'}
        </Btn>
        {recent.length === 0
          ? <Empty>No trend reports yet — click Run to research niches</Empty>
          : recent.map((t, i) => (
            <div key={i} style={{
              padding: '10px 12px', background: 'var(--paper-100)',
              border: '1px solid var(--paper-200)', borderRadius: 'var(--radius-md)',
            }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--ink-900)', marginBottom: 3,
                overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{t.niche}</div>
              {t.opportunity && (
                <div style={{ fontSize: 11, color: 'var(--ink-700)', lineHeight: 1.4,
                  overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>{t.opportunity}</div>
              )}
              {t.avg_price_usd && (
                <div style={{ fontSize: 10, color: 'var(--mint-600, var(--mint-500))', marginTop: 4, fontWeight: 700 }}>
                  avg ${Number(t.avg_price_usd).toFixed(2)} · {t.signal_count ?? 0} signals
                </div>
              )}
            </div>
          ))
        }
      </div>
    </Room>
  )
}

// ── ARCHIVES review room ──────────────────────────────────────────────────────
function RunHistoryItem({ run, onRerun, onExpand, expanded }) {
  const statusColor = run.status === 'done' ? 'var(--mint-500)' : run.status === 'error' ? 'var(--coral-500)' : run.status === 'running' ? 'var(--violet-500)' : 'var(--ink-400)'
  const started = run.started_at ? new Date(run.started_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
  return (
    <div style={{ border: '1px solid var(--paper-200)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 8 }}>
      <div
        onClick={onExpand}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: 'var(--paper-100)', cursor: 'pointer' }}>
        <div style={{ width: 6, height: 6, borderRadius: 99, background: statusColor, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-800)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            {run.command || run.niche || 'Pipeline run'}
          </div>
          <div style={{ fontSize: 9, color: 'var(--ink-500)', marginTop: 1 }}>
            {started} · {run.designs_created ?? 0} design(s) · <span style={{ color: statusColor }}>{run.status}</span>
          </div>
        </div>
        <Btn onClick={e => { e.stopPropagation(); onRerun(run.id) }} color="var(--violet-500)" small>↻ Re-run</Btn>
        <span style={{ fontSize: 10, color: 'var(--ink-400)' }}>{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--paper-200)' }}>
          <RunDetail runId={run.id} />
        </div>
      )}
    </div>
  )
}

function RunDetail({ runId }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    api.get(`/business/ellie/pipeline/runs/${runId}`)
      .then(r => setDetail(r.data))
      .catch(() => setDetail({ designs: [], activity: [] }))
      .finally(() => setLoading(false))
  }, [runId])
  if (loading) return <div style={{ fontSize: 10, color: 'var(--ink-400)', padding: '4px 0' }}>Loading…</div>
  const designs = detail?.designs ?? []
  const acts = detail?.activity ?? []
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {designs.length > 0 && (
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
            Designs ({designs.length})
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {designs.map(d => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {d.image_url
                  ? <img src={d.image_url} alt={d.concept_name} style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover' }} />
                  : <div style={{ width: 28, height: 28, borderRadius: 4, background: 'var(--paper-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>🎨</div>
                }
                <div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--ink-700)' }}>{d.concept_name}</div>
                  <div style={{ fontSize: 8, color: 'var(--ink-400)' }}>{d.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {acts.length > 0 && (
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Activity</div>
          {acts.slice(0, 8).map((a, i) => (
            <div key={i} style={{ fontSize: 9, color: 'var(--ink-600)', padding: '2px 0', borderBottom: '1px solid var(--paper-100)', lineHeight: 1.4 }}>
              <span style={{ color: 'var(--ink-400)', marginRight: 4 }}>[{a.agent}]</span>{a.message}
            </div>
          ))}
        </div>
      )}
      {designs.length === 0 && acts.length === 0 && (
        <div style={{ fontSize: 10, color: 'var(--ink-400)', fontStyle: 'italic' }}>No data linked to this run yet</div>
      )}
    </div>
  )
}

function ArchivesRoom({ queue, onVerdict, runs, onRerun }) {
  const [tab, setTab] = useState('queue')
  const [expandedRun, setExpandedRun] = useState(null)
  const tabStyle = (t) => ({
    padding: '5px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
    border: 'none', background: 'none', fontFamily: 'var(--font-ui)',
    color: tab === t ? 'var(--rose-500)' : 'var(--ink-500)',
    borderBottom: tab === t ? '2px solid var(--rose-500)' : '2px solid transparent',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--paper-200)', marginBottom: 12, flexShrink: 0 }}>
        <button style={tabStyle('queue')} onClick={() => setTab('queue')}>
          Review Queue {queue.length > 0 && `(${queue.length})`}
        </button>
        <button style={tabStyle('history')} onClick={() => setTab('history')}>
          Run History {runs.length > 0 && `(${runs.length})`}
        </button>
      </div>

      {tab === 'queue' && (
        queue.length === 0
          ? <Empty>Queue clear — no designs awaiting review</Empty>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
              {queue.map(d => (
                <div key={d.id} style={{
                  display: 'flex', gap: 12, alignItems: 'center',
                  padding: '10px 12px', background: 'var(--paper-100)',
                  border: '1px solid var(--paper-200)', borderRadius: 'var(--radius-md)',
                }}>
                  {d.image_url
                    ? <img src={d.image_url} alt={d.concept_name} style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                    : <div style={{ width: 52, height: 52, borderRadius: 8, background: 'var(--paper-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🎨</div>
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--ink-900)', marginBottom: 1 }}>{d.concept_name}</div>
                    <div style={{ fontSize: 10, color: 'var(--ink-600)', marginBottom: 6 }}>
                      {d.niche} · score {((d.forge_score ?? 0) * 100).toFixed(0)}%
                    </div>
                    {d.sell_reason && (
                      <div style={{ fontSize: 10, color: 'var(--ink-600)', marginBottom: 6, fontStyle: 'italic', lineHeight: 1.3 }}>{d.sell_reason}</div>
                    )}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Btn onClick={() => onVerdict(d.id, 'approve')} color="var(--mint-500)" small>✓ Approve</Btn>
                      <Btn onClick={() => onVerdict(d.id, 'iterate')} color="var(--amber-500)" small>↻ Iterate</Btn>
                      <Btn onClick={() => onVerdict(d.id, 'reject')} color="var(--coral-500)" small>✕ Reject</Btn>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
      )}

      {tab === 'history' && (
        runs.length === 0
          ? <Empty>No pipeline runs yet — give ELLIE a command to start</Empty>
          : (
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {runs.map(run => (
                <RunHistoryItem
                  key={run.id}
                  run={run}
                  onRerun={onRerun}
                  expanded={expandedRun === run.id}
                  onExpand={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
                />
              ))}
            </div>
          )
      )}
    </div>
  )
}

// ── TREASURY cost room ────────────────────────────────────────────────────────
function TreasuryRoom({ spend }) {
  const total = spend?.today_usd ?? 0
  const byAgent = spend?.by_agent ?? {}
  const limit = 10
  const pct = Math.min((total / limit) * 100, 100)
  const barColor = pct > 80 ? 'var(--coral-500)' : pct > 50 ? 'var(--amber-500)' : 'var(--mint-500)'
  const agents = Object.entries(byAgent).sort((a, b) => b[1] - a[1])

  return (
    <Room icon="💰" name="Treasury" accent="var(--peach-500)" status="online" style={{ gridArea: 'treasury' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Spend today */}
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: barColor, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
            ${Number(total).toFixed(2)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-400)', marginTop: 4 }}>spent today of ${limit} limit</div>
          <div style={{ marginTop: 10, height: 6, borderRadius: 3, background: 'var(--paper-200)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 3, transition: 'width 0.5s' }} />
          </div>
        </div>

        {/* By agent */}
        {agents.length > 0 && (
          <div>
            <Label>By Agent</Label>
            {agents.map(([agent, cost]) => (
              <div key={agent} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--paper-200)', fontSize: 12 }}>
                <span style={{ color: 'var(--ink-700)', fontWeight: 600 }}>{agent}</span>
                <span style={{ color: 'var(--peach-500)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                  ${Number(cost).toFixed(3)}
                </span>
              </div>
            ))}
          </div>
        )}
        {agents.length === 0 && <Empty>No spend recorded today</Empty>}
      </div>
    </Room>
  )
}

// ── Map room zone — hover highlight + clickable overlay on the RPG map ────────
function MapRoomZone({ room, isOnline, isAlert, onClick }) {
  const [hov, setHov] = useState(false)

  return (
    <>
      {/* Invisible hit zone that lights up on hover */}
      <div
        onClick={onClick}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        title={`Open ${room.label}`}
        style={{
          position: 'absolute',
          left: room.zoneLeft, top: room.zoneTop,
          width: room.zoneW, height: room.zoneH,
          zIndex: 3,
          cursor: 'pointer',
          background: hov ? `rgba(${room.accentRgb},0.16)` : `rgba(${room.accentRgb},0.03)`,
          boxShadow: hov
            ? `inset 0 0 0 2px rgba(${room.accentRgb},0.75), 0 0 40px rgba(${room.accentRgb},0.18)`
            : `inset 0 0 0 0.5px rgba(${room.accentRgb},0.15)`,
          transition: 'background 0.2s, box-shadow 0.2s',
          borderRadius: 2,
        }}
      >
        {hov && (
          <div style={{
            position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
            fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
            color: room.accent, letterSpacing: '0.16em', textTransform: 'uppercase',
            background: 'rgba(3,4,10,0.92)', border: `1px solid rgba(${room.accentRgb},0.5)`,
            padding: '3px 10px', borderRadius: 2, whiteSpace: 'nowrap',
            boxShadow: `0 0 12px rgba(${room.accentRgb},0.35)`,
          }}>▶ open room</div>
        )}
      </div>

      {/* Always-visible floating label chip */}
      <div style={{
        position: 'absolute',
        left: room.chipLeft, top: room.chipTop,
        transform: 'translateX(-50%)',
        zIndex: 4, pointerEvents: 'none',
        display: 'flex', alignItems: 'center', gap: 5,
        background: 'rgba(3,4,10,0.9)',
        border: `1px solid rgba(${room.accentRgb},${hov ? '0.7' : '0.38'})`,
        borderRadius: 3,
        padding: '3px 8px 3px 6px',
        backdropFilter: 'blur(6px)',
        boxShadow: isOnline ? `0 0 12px rgba(${room.accentRgb},0.4)` : 'none',
        transition: 'border-color 0.2s',
      }}>
        <div style={{
          width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
          background: isAlert ? '#FF6BA8' : isOnline ? room.accent : 'rgba(80,75,100,0.45)',
          boxShadow: (isOnline || isAlert) ? `0 0 6px ${room.accent}` : 'none',
          animation: (isOnline || isAlert) ? 'led-blink 1.8s ease-in-out infinite' : 'none',
        }} />
        <span style={{
          fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
          color: room.accent, textTransform: 'uppercase', letterSpacing: '0.12em',
          whiteSpace: 'nowrap',
        }}>{room.label}</span>
        {isAlert && (
          <span style={{
            fontSize: 7, fontFamily: 'var(--font-mono)', fontWeight: 700,
            color: '#FF6BA8', letterSpacing: '0.06em',
          }}>!</span>
        )}
      </div>
    </>
  )
}

// ── Agent room header — styled like reference image ───────────────────────────
// Rectangular label box at top of each room zone
// Matched to original corner layout map
const AGENT_HEADERS = [
  { roomId: 'nova',     left: '1%',  top: '1%',  accent: '#22D3A4', accentRgb: '34,211,164',  label: 'AGENT NOVA',     sub: 'TREND RESEARCH' },
  { roomId: 'activity', left: '71%', top: '1%',  accent: '#48BBFF', accentRgb: '72,187,255',  label: 'AGENT OPS',      sub: 'DATA ANALYSIS' },
  { roomId: 'forge',    left: '1%',  top: '62%', accent: '#FFB23F', accentRgb: '255,178,63',  label: 'AGENT FORGE',    sub: 'VISUAL DESIGN' },
  { roomId: 'archives', left: '31%', top: '74%', accent: '#FF6BA8', accentRgb: '255,107,168', label: 'AGENT VAULT',    sub: 'ARCHIVE & PUBLISH' },
  { roomId: 'treasury', left: '71%', top: '62%', accent: '#FFD600', accentRgb: '255,214,0',   label: 'AGENT TREASURY', sub: 'COST TRACKING' },
]

function AgentRoomHeader({ cfg, isOnline }) {
  return (
    <div style={{
      position: 'absolute', left: cfg.left, top: cfg.top,
      zIndex: 4, pointerEvents: 'none',
      background: 'rgba(1,2,8,0.92)',
      border: `1.5px solid rgba(${cfg.accentRgb},0.75)`,
      borderRadius: 3, padding: '5px 10px',
      backdropFilter: 'blur(8px)',
      boxShadow: `0 0 16px rgba(${cfg.accentRgb},0.35), inset 0 0 20px rgba(${cfg.accentRgb},0.04)`,
      minWidth: 130,
    }}>
      {/* Corner accent top-left */}
      <div style={{
        position: 'absolute', top: 2, left: 2, width: 7, height: 7,
        borderTop: `1.5px solid ${cfg.accent}`, borderLeft: `1.5px solid ${cfg.accent}`,
        opacity: 0.7,
      }} />
      {/* Corner accent top-right */}
      <div style={{
        position: 'absolute', top: 2, right: 2, width: 7, height: 7,
        borderTop: `1.5px solid ${cfg.accent}`, borderRight: `1.5px solid ${cfg.accent}`,
        opacity: 0.7,
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{
          width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
          background: isOnline ? cfg.accent : 'rgba(80,75,100,0.5)',
          boxShadow: isOnline ? `0 0 7px ${cfg.accent}` : 'none',
          animation: isOnline ? 'led-blink 1.4s ease-in-out infinite' : 'none',
        }} />
        <div>
          <div style={{
            fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
            color: cfg.accent, letterSpacing: '0.14em', textTransform: 'uppercase', lineHeight: 1.3,
          }}>{cfg.label}</div>
          <div style={{
            fontSize: 7, fontFamily: 'var(--font-mono)',
            color: `rgba(${cfg.accentRgb},0.65)`, letterSpacing: '0.1em', textTransform: 'uppercase', lineHeight: 1.2,
          }}>STATUS: {isOnline ? 'ACTIVE' : 'STANDBY'} · {cfg.sub}</div>
        </div>
      </div>
    </div>
  )
}

// ── Office room card ───────────────────────────────────────────────────────────
function CompactCard({ id, name, status, accent = 'var(--violet-500)', badge, onExpand, children, cardStyle = {} }) {
  const [hov, setHov] = useState(false)
  const isActive = status === 'online' || status === 'alert'
  const isCommand = id === 'ellie'

  return (
    <div
      onClick={() => onExpand(id)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        height: '100%',   // fill the absolute-positioned wrapper
        background: '#04050C',
        border: `1px solid ${hov
          ? `color-mix(in srgb, ${accent} 60%, rgba(10,10,18,1))`
          : isActive
            ? `color-mix(in srgb, ${accent} 32%, rgba(10,10,18,1))`
            : 'rgba(255,220,0,0.10)'}`,
        borderRadius: 4,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', cursor: 'pointer',
        boxShadow: hov
          ? `0 0 40px color-mix(in srgb, ${accent} 28%, transparent)`
          : isActive
            ? `0 0 ${isCommand ? 24 : 12}px color-mix(in srgb, ${accent} ${isCommand ? 18 : 10}%, transparent)`
            : 'none',
        transition: 'border-color 0.2s, box-shadow 0.35s',
        minHeight: 0, position: 'relative',
        animation: 'module-boot 0.35s ease-out both',
        ...cardStyle,
      }}
    >
      {/* HUD corner brackets */}
      {[['top','left'],['top','right'],['bottom','left'],['bottom','right']].map(([v,h]) => (
        <div key={v+h} style={{ position: 'absolute', [v]: 0, [h]: 0, width: 12, height: 12,
          [`border${v.charAt(0).toUpperCase()+v.slice(1)}`]: `2px solid ${accent}`,
          [`border${h.charAt(0).toUpperCase()+h.slice(1)}`]: `2px solid ${accent}`,
          opacity: hov ? 1 : 0.45, zIndex: 10, transition: 'opacity 0.2s' }} />
      ))}

      {/* Room nameplate header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '6px 12px',
        borderBottom: `1px solid color-mix(in srgb, ${accent} 18%, rgba(8,8,16,1))`,
        background: `color-mix(in srgb, ${accent} 9%, rgba(3,4,10,1))`,
        flexShrink: 0, zIndex: 5, position: 'relative',
      }}>
        <div style={{
          width: 5, height: 5, borderRadius: 99, flexShrink: 0,
          background: isActive ? accent : 'rgba(60,58,80,0.45)',
          boxShadow: isActive ? `0 0 5px ${accent}` : 'none',
          animation: isActive ? 'led-blink 4s ease-in-out infinite' : 'none',
        }} />
        <span style={{
          fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 9,
          color: hov ? accent : `color-mix(in srgb, ${accent} 60%, rgba(168,196,232,1))`,
          flex: 1, textTransform: 'uppercase', letterSpacing: '0.1em',
          transition: 'color 0.2s',
        }}>{name}</span>
        {badge}
        {isCommand && (
          <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
            color: accent, opacity: 0.7, letterSpacing: '0.06em' }}>⚡ exec</span>
        )}
        <span style={{
          fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
          color: hov ? '#E2EDFF' : 'rgba(100,140,200,0.35)',
          transition: 'color 0.15s', textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          {hov ? '[ open ]' : status === 'online' ? 'live' : status === 'alert' ? 'attn' : 'stby'}
        </span>
      </div>

      {/* Office scene — pixel art room background + character + desk */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
        {/* AgentRoom renders: room bg image, character sprite, desk prop */}
        <AgentRoom agentId={id} active={isActive} />

        {/* Data info overlay — floats above the room scene */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 4,
          padding: '8px 12px 16px',
          background: 'linear-gradient(180deg, rgba(2,3,8,0.90) 45%, rgba(2,3,8,0) 100%)',
          pointerEvents: 'none',
        }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Room expand modal ─────────────────────────────────────────────────────────
function RoomModal({ icon, title, onClose, wide, visible, children }) {
  useEffect(() => {
    if (!visible) return
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose, visible])
  return (
    <div
      style={{
        display: visible ? 'flex' : 'none',
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(2,4,14,0.82)',
        backdropFilter: 'blur(8px)',
        alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#060C1E',
        border: '1px solid rgba(255,220,0,0.22)',
        borderRadius: 4,
        width: '100%', maxWidth: wide ? 900 : 680, height: '84vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 0 50px rgba(255,220,0,0.06), 0 24px 80px rgba(0,0,0,0.95)',
        position: 'relative', animation: 'module-boot 0.2s ease-out both',
      }}>
        {/* Corner brackets */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: 14, height: 14,
          borderTop: '2px solid rgba(255,220,0,0.5)', borderLeft: '2px solid rgba(255,220,0,0.5)', zIndex: 5 }} />
        <div style={{ position: 'absolute', top: 0, right: 0, width: 14, height: 14,
          borderTop: '2px solid rgba(255,220,0,0.5)', borderRight: '2px solid rgba(255,220,0,0.5)', zIndex: 5 }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: 14, height: 14,
          borderBottom: '2px solid rgba(255,220,0,0.5)', borderLeft: '2px solid rgba(255,220,0,0.5)', zIndex: 5 }} />
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: 14, height: 14,
          borderBottom: '2px solid rgba(255,220,0,0.5)', borderRight: '2px solid rgba(255,220,0,0.5)', zIndex: 5 }} />

        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 20px',
          borderBottom: '1px solid rgba(255,220,0,0.14)',
          background: 'rgba(5,5,8,0.98)', flexShrink: 0,
        }}>
          <span style={{ fontSize: 14 }}>{icon}</span>
          <span style={{
            fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12,
            color: '#A8C4E8', flex: 1, textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>{title}</span>
          <button onClick={onClose} style={{
            background: 'rgba(40,70,140,0.18)',
            border: '1px solid rgba(255,220,0,0.3)',
            borderRadius: 2, color: 'rgba(255,220,0,0.7)',
            cursor: 'pointer', padding: '4px 14px', fontSize: 11,
            fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.06em',
          }}>[ esc ]</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Compact card summaries ────────────────────────────────────────────────────
function Stat({ value, label, color }) {
  return (
    <div>
      <div style={{ fontSize: 26, fontWeight: 800, color: color || 'var(--ink-800)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--ink-600)', marginTop: 3 }}>{label}</div>
    </div>
  )
}

function MiniBar({ pct, color }) {
  return (
    <div style={{ height: 4, background: 'var(--paper-200)', borderRadius: 99, marginTop: 6 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.4s' }} />
    </div>
  )
}

function EllieSummary({ status, pipeline, roomStatus }) {
  const spend = status?.metrics?.find(m => m.label === 'Spend today')?.value ?? '$0.00'
  const activePipeline = roomStatus?.pipeline ?? pipeline
  const running = activePipeline?.running

  let statusLine = null
  if (roomStatus?.thinking) {
    statusLine = <div style={{ fontSize: 11, color: 'var(--violet-500)', fontWeight: 700 }}>⏳ Thinking…</div>
  } else if (roomStatus?.strategyReport) {
    statusLine = <div style={{ fontSize: 11, color: 'var(--mint-500)', fontWeight: 700 }}>📊 Strategy report ready — click to view</div>
  } else if (roomStatus?.exploreReport) {
    const n = roomStatus.exploreReport?.opportunities?.length || 0
    statusLine = <div style={{ fontSize: 11, color: 'var(--amber-500)', fontWeight: 700 }}>🔍 {n} trending niches found — click to explore</div>
  } else if (roomStatus?.plan && !roomStatus.plan.error) {
    statusLine = <div style={{ fontSize: 11, color: 'var(--violet-500)', fontWeight: 700 }}>📋 Plan ready — click to review & run</div>
  } else if (!running) {
    statusLine = <div style={{ fontSize: 11, color: 'var(--ink-500)', fontStyle: 'italic' }}>Click to give ELLIE a command</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 12, color: 'var(--ink-700)' }}>Spend today: <strong style={{ color: 'var(--ink-900)' }}>{spend}</strong></div>
      {running ? (
        <>
          <MiniBar pct={activePipeline.pct} color="var(--violet-500)" />
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--violet-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            ⚙ {activePipeline.step} — {activePipeline.pct}%
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-600)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.4 }}>{activePipeline.detail}</div>
        </>
      ) : statusLine}
    </div>
  )
}

function ForgeSummary({ queue, progress }) {
  const running = progress?.running
  const color = queue.length > 0 ? 'var(--amber-500)' : 'var(--ink-400)'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Stat value={queue.length} label={queue.length === 1 ? 'design in queue' : 'designs in queue'} color={color} />
      {running && (
        <>
          <MiniBar pct={progress.pct} color="var(--amber-500)" />
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--amber-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            ⚙ {progress.step} — {progress.pct}%
          </div>
        </>
      )}
    </div>
  )
}

function NovaSummary({ trends }) {
  const items = trends?.trends ?? []
  const latest = items[0]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Stat value={items.length} label="niches researched" color="var(--mint-500)" />
      {latest
        ? <div style={{ fontSize: 11, color: 'var(--ink-700)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>Latest: {latest.niche}</div>
        : <div style={{ fontSize: 11, color: 'var(--ink-500)', fontStyle: 'italic' }}>No research yet — click to run Nova</div>
      }
    </div>
  )
}

function ArchivesSummary({ queue, publishProgress }) {
  const urgent = queue.length > 0
  const pub = publishProgress
  const publishing = pub?.running
  const justDone = !pub?.running && pub?.step === 'done' && pub?.drafts_created > 0
  const pubError = !pub?.running && pub?.step === 'error'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Stat value={queue.length} label="awaiting review" color={urgent ? 'var(--rose-500)' : 'var(--ink-400)'} />

      {/* Publish pipeline status */}
      {publishing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--violet-500)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Publishing to Printify…
          </div>
          <div style={{ fontSize: 10, color: 'var(--ink-600)', lineHeight: 1.4 }}>
            {pub.design_name && <span style={{ fontWeight: 600 }}>{pub.design_name}</span>}
            {pub.current_product && <span> → {pub.current_product}</span>}
          </div>
          {pub.products_total > 0 && (
            <div style={{ height: 3, background: 'var(--paper-200)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 99, background: 'var(--violet-500)',
                width: `${Math.round((pub.products_done / pub.products_total) * 100)}%`,
                transition: 'width 0.4s ease' }} />
            </div>
          )}
        </div>
      )}
      {justDone && (
        <div style={{ fontSize: 10, color: 'var(--mint-500)', fontWeight: 700 }}>
          ✓ {pub.drafts_created} draft{pub.drafts_created !== 1 ? 's' : ''} created on Printify
        </div>
      )}
      {pubError && (
        <div style={{ fontSize: 10, color: 'var(--coral-500)' }}>
          ✕ Publish failed — {pub.error?.slice(0, 60)}
        </div>
      )}

      {urgent && !publishing && (
        <div style={{ display: 'flex', gap: 4 }}>
          {queue.slice(0, 5).map(d => (
            d.image_url
              ? <img key={d.id} src={d.image_url} alt="" style={{ width: 26, height: 26, borderRadius: 4, objectFit: 'cover' }} />
              : <div key={d.id} style={{ width: 26, height: 26, borderRadius: 4, background: 'var(--paper-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>🎨</div>
          ))}
          {queue.length > 5 && <div style={{ width: 26, height: 26, borderRadius: 4, background: 'var(--paper-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'var(--ink-500)', fontWeight: 700 }}>+{queue.length - 5}</div>}
        </div>
      )}
    </div>
  )
}

function TreasurySummary({ spend }) {
  const total = spend?.today_usd ?? 0
  const limit = 10
  const pct = Math.min((total / limit) * 100, 100)
  const color = pct > 80 ? 'var(--coral-500)' : pct > 50 ? 'var(--amber-500)' : 'var(--mint-500)'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Stat value={`$${Number(total).toFixed(2)}`} label={`of $${limit} daily limit`} color={color} />
      <MiniBar pct={pct} color={color} />
    </div>
  )
}

function ActivitySummary({ status, activity }) {
  const agents = status?.agents ?? []
  const recent = activity?.items?.slice(0, 3) ?? []
  const total = activity?.items?.length ?? 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {agents.map(a => (
          <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 6, height: 6, borderRadius: 99, flexShrink: 0, background: a.status === 'online' ? 'var(--mint-500)' : 'var(--ink-300)' }} />
            <span style={{ fontSize: 10, color: 'var(--ink-700)', fontWeight: 600 }}>{a.name}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10, color: 'var(--ink-500)' }}>{total} event{total !== 1 ? 's' : ''} logged</div>
      {recent.map((item, i) => (
        <div key={i} style={{ fontSize: 10, color: 'var(--ink-500)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {item.agent ? <span style={{ color: AGENT_COLORS[item.agent] ?? 'var(--ink-400)', fontWeight: 700, marginRight: 4 }}>[{item.agent}]</span> : null}
          {item.summary || item.message || '—'}
        </div>
      ))}
    </div>
  )
}

const AGENT_COLORS = {
  nova: 'var(--mint-500)',
  forge: 'var(--amber-500)',
  archives: 'var(--rose-500)',
  printify: 'var(--violet-500)',
  ellie: 'var(--violet-500)',
  treasury: 'var(--peach-500)',
}

// ── Activity room (for expanded modal) ───────────────────────────────────────
function ActivityRoom({ status, activity }) {
  const agents = status?.agents ?? []
  const alerts = status?.alerts ?? []
  const items = activity?.items ?? []

  const fmtTime = (ts) => {
    if (!ts) return ''
    try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } catch { return '' }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Agent status row */}
      <div>
        <Label>Agent Status</Label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {agents.length === 0
            ? <Empty>No agent data</Empty>
            : agents.map(a => (
              <div key={a.name} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 10px', background: 'var(--paper-100)',
                border: '1px solid var(--paper-200)', borderRadius: 99,
              }}>
                <div style={{ width: 6, height: 6, borderRadius: 99, background: a.status === 'online' ? 'var(--mint-500)' : a.status === 'error' ? 'var(--coral-500)' : 'var(--ink-300)' }} />
                <span style={{ fontSize: 11, color: 'var(--ink-800)', fontWeight: 600 }}>{a.name}</span>
              </div>
            ))
          }
        </div>
      </div>

      {/* Event log */}
      <div style={{ flex: 1 }}>
        <Label>Event Log ({items.length})</Label>
        {items.length === 0
          ? <Empty>No activity yet — run a pipeline to see events here</Empty>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {items.map((item, i) => {
                const agentColor = AGENT_COLORS[item.agent] ?? 'var(--ink-400)'
                return (
                  <div key={i} style={{
                    display: 'flex', gap: 8, alignItems: 'flex-start',
                    padding: '6px 0', borderBottom: '1px solid var(--paper-200)',
                  }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                      color: agentColor, minWidth: 44, paddingTop: 1,
                    }}>{item.agent || '—'}</span>
                    <span style={{ fontSize: 11, color: 'var(--ink-700)', flex: 1, lineHeight: 1.4 }}>
                      {item.summary || item.message || '—'}
                    </span>
                    <span style={{ fontSize: 9, color: 'var(--ink-400)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                      {fmtTime(item.ts)}
                    </span>
                  </div>
                )
              })}
            </div>
          )
        }
      </div>

      {alerts.length > 0 && (
        <div>
          <Label>Alerts</Label>
          {alerts.map((a, i) => (
            <div key={i} style={{ fontSize: 11, color: 'var(--coral-500)', padding: '4px 0' }}>{a.msg || a.message || a}</div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Product Maker modal ───────────────────────────────────────────────────────
const STATUS_BADGE_COLOR = {
  approved: 'var(--mint-500)',
  draft_on_printify: 'var(--violet-500)',
  listed: 'var(--sky-500, #38bdf8)',
  pending_drew_review: 'var(--amber-500)',
}

function ProductMakerModal({ visible, onClose }) {
  const [designs, setDesigns] = useState([])
  const [catalog, setCatalog] = useState([])
  const [selectedDesigns, setSelectedDesigns] = useState(new Set())
  const [selectedProducts, setSelectedProducts] = useState(new Set())
  const [queue, setQueue] = useState([])
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!visible) return
    Promise.all([
      api.get('/business/products/designs', { params: { limit: 60 } }),
      api.get('/business/products/catalog'),
    ]).then(([d, c]) => {
      setDesigns(d.data?.designs ?? [])
      setCatalog(c.data?.products ?? [])
    }).catch(() => {})
  }, [visible])

  useEffect(() => {
    if (!visible) return
    const fn = e => { if (e.key === 'Escape' && !running) onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [visible, onClose, running])

  const toggleDesign = id => setSelectedDesigns(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const toggleProduct = key => setSelectedProducts(prev => {
    const next = new Set(prev)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })

  const runBatch = async () => {
    const designList = designs.filter(d => selectedDesigns.has(d.id))
    const productList = [...selectedProducts]
    const combos = designList.flatMap(d =>
      productList.map(p => ({
        key: `${d.id}:${p}`,
        design: d,
        product: p,
        productLabel: catalog.find(c => c.key === p)?.label ?? p,
        status: 'pending',
        result: null,
      }))
    )
    setQueue(combos)
    setRunning(true)

    for (let i = 0; i < combos.length; i++) {
      setQueue(q => q.map((item, idx) => idx === i ? { ...item, status: 'generating' } : item))
      try {
        const copyRes = await api.post('/business/products/generate_copy', {
          design_id: combos[i].design.id,
          product_type: combos[i].product,
        })
        const copy = copyRes.data
        if (copy.error) throw new Error(copy.error)

        setQueue(q => q.map((item, idx) => idx === i ? { ...item, status: 'creating' } : item))

        const draftRes = await api.post('/business/products/create_draft', {
          design_id: combos[i].design.id,
          product_type: combos[i].product,
          title: copy.title,
          description: copy.description,
          tags: copy.tags || [],
          price_usd: copy.price_usd || 19.99,
        })
        setQueue(q => q.map((item, idx) => idx === i ? {
          ...item,
          status: draftRes.data.ok ? 'done' : 'error',
          result: draftRes.data,
        } : item))
      } catch (e) {
        setQueue(q => q.map((item, idx) => idx === i ? {
          ...item, status: 'error', result: { error: e.message },
        } : item))
      }
    }
    setRunning(false)
  }

  const total = selectedDesigns.size * selectedProducts.size
  const canRun = total > 0 && !running
  const inQueue = queue.length > 0
  const doneCount = queue.filter(i => i.status === 'done').length
  const completedCount = queue.filter(i => i.status === 'done' || i.status === 'error').length

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        background: 'rgba(10,8,15,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
      onClick={e => { if (e.target === e.currentTarget && !running) onClose() }}
    >
      <div style={{
        background: 'var(--paper-50)', border: '1.5px solid var(--ink-300)',
        borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 960,
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 32px 100px rgba(0,0,0,0.35)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 20px', borderBottom: '1px solid var(--paper-200)',
          background: 'var(--paper-100)', flexShrink: 0,
        }}>
          <span style={{ fontSize: 16 }}>⚒</span>
          <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink-900)', flex: 1 }}>Product Maker</span>
          <span style={{ fontSize: 11, color: 'var(--ink-500)' }}>
            {inQueue
              ? running ? `Creating listings… ${completedCount}/${queue.length}` : `Done — ${doneCount}/${queue.length} succeeded`
              : 'Select designs + products → ELLIE writes listings → straight to Printify'}
          </span>
          {!running && (
            <button onClick={onClose} style={{
              marginLeft: 12, background: 'none', border: '1.5px solid var(--ink-300)',
              borderRadius: 'var(--radius-sm)', color: 'var(--ink-600)', cursor: 'pointer',
              padding: '4px 14px', fontSize: 12, fontFamily: 'var(--font-ui)', fontWeight: 700,
            }}>✕ <span style={{ fontSize: 10, opacity: 0.5 }}>Esc</span></button>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {!inQueue ? (
            <>
              {/* Pickers row */}
              <div style={{ display: 'flex', gap: 20 }}>

                {/* Design picker */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Label>
                    1 · Select Designs
                    <span style={{ fontWeight: 400, color: 'var(--ink-400)', marginLeft: 6 }}>
                      {selectedDesigns.size > 0 ? `${selectedDesigns.size} selected` : ''}
                    </span>
                  </Label>
                  {designs.length === 0
                    ? <Empty>No designs yet — run Forge first</Empty>
                    : (
                      <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(82px, 1fr))',
                        gap: 8, maxHeight: 340, overflowY: 'auto', paddingRight: 4,
                      }}>
                        {designs.map(d => {
                          const sel = selectedDesigns.has(d.id)
                          return (
                            <div
                              key={d.id}
                              onClick={() => toggleDesign(d.id)}
                              style={{
                                position: 'relative', borderRadius: 'var(--radius-md)',
                                overflow: 'hidden', cursor: 'pointer',
                                border: `2px solid ${sel ? 'var(--violet-500)' : 'transparent'}`,
                                boxShadow: sel ? '0 0 0 3px rgba(122,110,142,0.2)' : 'none',
                                background: 'var(--paper-100)', transition: 'border-color 0.12s, box-shadow 0.12s',
                              }}
                            >
                              <div style={{
                                position: 'absolute', top: 4, right: 4, zIndex: 2,
                                width: 16, height: 16, borderRadius: 4,
                                background: sel ? 'var(--violet-500)' : 'rgba(0,0,0,0.45)',
                                border: sel ? 'none' : '1px solid rgba(255,255,255,0.3)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 9, color: 'white', fontWeight: 700,
                              }}>
                                {sel && '✓'}
                              </div>
                              {d.image_url
                                ? <img src={d.image_url} alt={d.concept_name} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                                : <div style={{ width: '100%', aspectRatio: '1', background: 'var(--paper-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🎨</div>
                              }
                              <div style={{ padding: '4px 5px' }}>
                                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--ink-700)', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                  {d.concept_name}
                                </div>
                                <div style={{ fontSize: 8, color: STATUS_BADGE_COLOR[d.status] ?? 'var(--ink-400)', marginTop: 1, fontWeight: 600 }}>
                                  {d.status?.replace(/_/g, ' ')}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  }
                </div>

                {/* Product picker */}
                <div style={{ width: 230, flexShrink: 0 }}>
                  <Label>
                    2 · Select Products
                    <span style={{ fontWeight: 400, color: 'var(--ink-400)', marginLeft: 6 }}>
                      {selectedProducts.size > 0 ? `${selectedProducts.size} selected` : ''}
                    </span>
                  </Label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 340, overflowY: 'auto' }}>
                    {catalog.map(c => {
                      const sel = selectedProducts.has(c.key)
                      return (
                        <div
                          key={c.key}
                          onClick={() => toggleProduct(c.key)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '7px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                            background: sel ? 'rgba(122,110,142,0.10)' : 'var(--paper-100)',
                            border: `1px solid ${sel ? 'var(--violet-500)' : 'var(--paper-200)'}`,
                            transition: 'all 0.1s',
                          }}
                        >
                          <div style={{
                            width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                            background: sel ? 'var(--violet-500)' : 'transparent',
                            border: `1.5px solid ${sel ? 'var(--violet-500)' : 'var(--ink-400)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 9, color: 'white', fontWeight: 700,
                          }}>
                            {sel && '✓'}
                          </div>
                          <div style={{ flex: 1, fontSize: 12, fontWeight: sel ? 700 : 500, color: sel ? 'var(--ink-900)' : 'var(--ink-700)' }}>
                            {c.label}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--mint-500)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                            ${c.price_usd.toFixed(0)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Summary + run */}
              <div style={{
                borderTop: '1px solid var(--paper-200)', paddingTop: 16,
                display: 'flex', alignItems: 'center', gap: 16,
              }}>
                <div style={{ flex: 1 }}>
                  {total > 0 ? (
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-800)' }}>
                      <span style={{ color: 'var(--violet-500)' }}>{selectedDesigns.size}</span> design{selectedDesigns.size !== 1 ? 's' : ''}{' '}
                      ×{' '}
                      <span style={{ color: 'var(--violet-500)' }}>{selectedProducts.size}</span> product{selectedProducts.size !== 1 ? 's' : ''}{' '}
                      ={' '}
                      <span style={{ color: 'var(--mint-500)' }}>{total} listing{total !== 1 ? 's' : ''}</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--ink-400)', fontStyle: 'italic' }}>
                      Select at least one design and one product to continue.
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: 'var(--ink-400)', marginTop: 3 }}>
                    ELLIE auto-generates listing copy for each combination.
                  </div>
                </div>
                <Btn onClick={runBatch} disabled={!canRun} color="var(--mint-500)">
                  → Create {total > 0 ? `${total} ` : ''}Listing{total !== 1 ? 's' : ''}
                </Btn>
              </div>
            </>
          ) : (
            /* Queue view */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexShrink: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-800)' }}>
                  {running
                    ? `Processing ${completedCount} / ${queue.length}…`
                    : `Done — ${doneCount} of ${queue.length} created successfully`}
                </div>
                {!running && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn onClick={() => { setQueue([]); setSelectedDesigns(new Set()); setSelectedProducts(new Set()) }} color="var(--violet-500)">
                      ← Make More
                    </Btn>
                    <Btn onClick={onClose} color="var(--ink-400)">✕ Close</Btn>
                  </div>
                )}
              </div>

              {queue.map(item => {
                const statusColor = {
                  pending: 'var(--ink-400)', generating: 'var(--amber-500)',
                  creating: 'var(--violet-500)', done: 'var(--mint-500)', error: 'var(--coral-500)',
                }[item.status]
                const statusLabel = {
                  pending: '···', generating: '⏳ Writing copy…',
                  creating: '⏳ Sending to Printify…', done: '✓ Created', error: '✕ Failed',
                }[item.status]
                return (
                  <div key={item.key} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', borderRadius: 'var(--radius-md)',
                    background: 'var(--paper-100)',
                    border: `1px solid ${item.status === 'done' ? 'var(--mint-500)' : item.status === 'error' ? 'var(--coral-500)' : 'var(--paper-200)'}`,
                  }}>
                    {item.design.image_url
                      ? <img src={item.design.image_url} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                      : <div style={{ width: 36, height: 36, borderRadius: 6, background: 'var(--paper-200)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🎨</div>
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-900)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        {item.design.concept_name}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--ink-500)' }}>{item.productLabel}</div>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: statusColor, whiteSpace: 'nowrap' }}>
                      {statusLabel}
                    </div>
                    {item.result?.error && (
                      <div style={{ fontSize: 9, color: 'var(--coral-500)', maxWidth: 180, textAlign: 'right', lineHeight: 1.3 }}>
                        {item.result.error}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main BusinessFactory ──────────────────────────────────────────────────────
export default function BusinessFactory() {
  const [status,        setStatus]        = useState(null)
  const [activity,      setActivity]      = useState(null)
  const [queue,         setQueue]         = useState([])
  const [trends,        setTrends]        = useState(null)
  const [spend,         setSpend]         = useState(null)
  const [forgeProgress,     setForgeProgress]     = useState(null)
  const [elliePipeline,     setElliePipeline]     = useState(null)
  const [ellieRoomStatus,   setEllieRoomStatus]   = useState({ thinking: false, plan: null, strategyReport: null, exploreReport: null, pipeline: null })
  const [publishProgress,   setPublishProgress]   = useState(null)
  const [pipelineRuns,      setPipelineRuns]      = useState([])
  const [paused,            setPaused]            = useState(false)
  const [loading,           setLoading]           = useState(true)
  const [expanded,          setExpanded]          = useState(null)
  const [showWorkshop,      setShowWorkshop]      = useState(false)

  const fetchAll = useCallback(async () => {
    const [s, act, q, tr, sp, fp, ep, pp, runs] = await Promise.all([
      api.get('/business/status').catch(() => null),
      api.get('/business/activity', { params: { limit: 40 } }).catch(() => null),
      api.get('/business/forge/queue', { params: { limit: 20 } }).catch(() => null),
      api.get('/business/nova/trends', { params: { limit: 5 } }).catch(() => null),
      api.get('/business/treasury/spend').catch(() => null),
      api.get('/business/forge/progress').catch(() => null),
      api.get('/business/ellie/pipeline').catch(() => null),
      api.get('/business/archives/publish_progress').catch(() => null),
      api.get('/business/ellie/pipeline/runs', { params: { limit: 20 } }).catch(() => null),
    ])
    setStatus(s?.data ?? null)
    setActivity(act?.data ?? null)
    setQueue(q?.data?.designs ?? [])
    setTrends(tr?.data ?? null)
    setSpend(sp?.data ?? null)
    setForgeProgress(fp?.data ?? null)
    setElliePipeline(ep?.data ?? null)
    setPublishProgress(pp?.data ?? null)
    setPipelineRuns(runs?.data?.runs ?? [])
    setPaused(s?.data?.paused ?? false)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 8000)
    return () => clearInterval(interval)
  }, [fetchAll])

  const togglePause = async () => {
    await api.post(paused ? '/business/resume' : '/business/pause', {}).catch(() => null)
    setPaused(p => !p)
  }

  const handleForgeRun = async (niche, nConcepts) => {
    await api.post('/business/forge/run', { niche, n_concepts: nConcepts }).catch(() => null)
    setTimeout(fetchAll, 2000)
  }

  const handleNovaRun = async () => {
    await api.post('/business/nova/run').catch(() => null)
    setTimeout(fetchAll, 3000)
  }

  const handleVerdict = async (designId, verdict) => {
    await api.post('/business/archives/feedback', {
      target_kind: 'design', target_id: designId, verdict, notes: '',
    }).catch(() => null)
    setQueue(q => q.filter(d => d.id !== designId))
  }

  const handleRerun = async (runId) => {
    await api.post(`/business/ellie/pipeline/runs/${runId}/rerun`).catch(() => null)
    setTimeout(fetchAll, 1000)
  }

  const handlePublishAll = async () => {
    await api.post('/business/archives/publish_all').catch(() => null)
    setTimeout(fetchAll, 1500)
  }

  const handleRunNovaManual = async () => {
    await api.post('/business/nova/run').catch(() => null)
    setTimeout(fetchAll, 3000)
  }

  const handleRunForgeManual = async () => {
    await api.post('/business/forge/run', { niche: 'trending niches', n_concepts: 3 }).catch(() => null)
    setTimeout(fetchAll, 2000)
  }

  const pendingCount = queue.length
  const spendToday = spend?.today_usd ?? 0

  // Per-room status for the map chips
  const roomStatuses = {
    ellie: (ellieRoomStatus.thinking || (ellieRoomStatus.pipeline ?? elliePipeline)?.running)
      ? 'online'
      : (status?.agents?.find(a => a.name === 'ELLIE')?.status ?? 'idle'),
    nova:     (trends?.trends?.length ?? 0) > 0 ? 'online' : 'idle',
    activity: status?.agents?.some(a => a.status === 'online') ? 'online' : 'idle',
    forge:    forgeProgress?.running || queue.length > 0 ? 'online' : 'idle',
    archives: publishProgress?.running ? 'online' : queue.length > 0 ? 'alert' : 'online',
    treasury: 'online',
  }

  return (
    <RoomShell
      title="ELLIE Corp HQ"
      gradient="var(--grad-violet)"
      icon="⚡"
      contentStyle={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      outerStyle={{ background: '#060609' }}
      headerStyle={{ background: 'rgba(5,5,8,0.98)', borderBottomColor: 'rgba(255,220,0,0.22)' }}
      actions={
        <>
          <StatusPill status={loading ? 'offline' : paused ? 'paused' : 'online'} />
          {pendingCount > 0 && (
            <span style={{
              background: 'rgba(255,107,168,0.15)', border: '1px solid var(--rose-500)',
              borderRadius: 'var(--radius-full)', color: 'var(--rose-500)',
              fontWeight: 700, fontSize: 11, padding: '3px 10px',
            }}>{pendingCount} to review</span>
          )}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-500)' }}>
            ${Number(spendToday).toFixed(2)} today
          </span>
          <GameBtn onClick={() => setShowWorkshop(true)} color="var(--violet-500)">⚒ Workshop</GameBtn>
          <GameBtn onClick={togglePause} disabled={loading} color={paused ? 'var(--mint-500)' : 'var(--amber-500)'}>
            {paused ? '▶ Resume' : '⏸ Pause'}
          </GameBtn>
        </>
      }
    >
      {/* Pipeline stages bar — only shown when active */}
      <PipelineBar pipeline={elliePipeline} queue={queue} publishProgress={publishProgress} />

      {/* ── Corp Office — single unified RPG floor map ── */}
      <div style={{
        flex: 1, minHeight: 0,
        position: 'relative',
        overflow: 'hidden',
        background: '#030408',
      }}>
        {/* The office map IS the floor — one cohesive pixel art building */}
        <img
          src="/sprites/office-map.png"
          alt="ELLIE Corp HQ Floor Plan"
          draggable={false}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'fill',
            imageRendering: 'pixelated',
            zIndex: 0,
          }}
        />

        {/* Subtle depth overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(3,4,10,0.18)',
          zIndex: 1, pointerEvents: 'none',
        }} />

        {/* ── CRT scan-line overlay ── */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
          backgroundImage: 'repeating-linear-gradient(transparent 0px, transparent 3px, rgba(0,0,0,0.10) 3px, rgba(0,0,0,0.10) 4px)',
          backgroundSize: '100% 4px',
          animation: 'scanline-scroll 0.18s linear infinite',
        }} />

        {/* ── Corridor data beam strips — light traveling along floor conduits ── */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none', overflow: 'hidden' }}>
          {/* Horizontal beam 1 — purple, through center corridor */}
          <div style={{
            position: 'absolute', top: '46%', left: '-12%',
            width: '12%', height: 3,
            background: 'linear-gradient(90deg, transparent, rgba(155,114,255,1), rgba(155,114,255,0.5), transparent)',
            filter: 'blur(1.5px)',
            boxShadow: '0 0 12px rgba(155,114,255,0.9), 0 0 24px rgba(155,114,255,0.4)',
            animation: 'data-beam-h 5.2s ease-in-out infinite',
          }} />
          {/* Horizontal beam 2 — teal, offset timing */}
          <div style={{
            position: 'absolute', top: '51%', left: '-12%',
            width: '10%', height: 2,
            background: 'linear-gradient(90deg, transparent, rgba(34,211,164,0.9), rgba(34,211,164,0.4), transparent)',
            filter: 'blur(1px)',
            boxShadow: '0 0 10px rgba(34,211,164,0.7), 0 0 20px rgba(34,211,164,0.3)',
            animation: 'data-beam-h 7.8s ease-in-out infinite 2.6s',
          }} />
          {/* Horizontal beam 3 — yellow, slow */}
          <div style={{
            position: 'absolute', top: '49%', left: '-12%',
            width: '8%', height: 2,
            background: 'linear-gradient(90deg, transparent, rgba(255,220,0,0.8), rgba(255,220,0,0.3), transparent)',
            filter: 'blur(1px)',
            boxShadow: '0 0 8px rgba(255,220,0,0.6)',
            animation: 'data-beam-h 11.4s ease-in-out infinite 5.1s',
          }} />
          {/* Vertical beam 1 — cyan, top to bottom */}
          <div style={{
            position: 'absolute', left: '47%', top: '-12%',
            width: 3, height: '12%',
            background: 'linear-gradient(180deg, transparent, rgba(72,187,255,1), rgba(72,187,255,0.5), transparent)',
            filter: 'blur(1.5px)',
            boxShadow: '0 0 12px rgba(72,187,255,0.9), 0 0 24px rgba(72,187,255,0.4)',
            animation: 'data-beam-v 6.4s ease-in-out infinite 1.4s',
          }} />
          {/* Vertical beam 2 — pink, offset */}
          <div style={{
            position: 'absolute', left: '51%', top: '-12%',
            width: 2, height: '10%',
            background: 'linear-gradient(180deg, transparent, rgba(255,107,168,0.9), rgba(255,107,168,0.4), transparent)',
            filter: 'blur(1px)',
            boxShadow: '0 0 10px rgba(255,107,168,0.7)',
            animation: 'data-beam-v 9.1s ease-in-out infinite 4.2s',
          }} />
          {/* Vertical beam 3 — amber, slow */}
          <div style={{
            position: 'absolute', left: '49%', top: '-12%',
            width: 2, height: '8%',
            background: 'linear-gradient(180deg, transparent, rgba(255,178,63,0.8), rgba(255,178,63,0.3), transparent)',
            filter: 'blur(1px)',
            boxShadow: '0 0 8px rgba(255,178,63,0.6)',
            animation: 'data-beam-v 13.5s ease-in-out infinite 7.8s',
          }} />
        </div>

        {/* ── Room monitor screen glows — data being transferred on terminals ── */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none', overflow: 'hidden' }}>
          {/* Nova top-left: research terminal screens */}
          <div style={{
            position: 'absolute', left: '4%', top: '7%', width: '15%', height: '9%',
            background: 'rgba(34,211,164,0.06)',
            boxShadow: '0 0 24px rgba(34,211,164,0.22), inset 0 0 16px rgba(34,211,164,0.14)',
            animation: 'monitor-glow 3.4s ease-in-out infinite',
            borderRadius: 2,
          }} />
          {/* Nova sub-monitor (smaller, tighter) */}
          <div style={{
            position: 'absolute', left: '6%', top: '20%', width: '10%', height: '6%',
            background: 'rgba(34,211,164,0.05)',
            boxShadow: '0 0 16px rgba(34,211,164,0.18), inset 0 0 10px rgba(34,211,164,0.10)',
            animation: 'monitor-glow 2.1s ease-in-out infinite 1.1s',
            borderRadius: 2,
          }} />
          {/* Activity top-right: analysis screens */}
          <div style={{
            position: 'absolute', right: '4%', top: '7%', width: '15%', height: '9%',
            background: 'rgba(72,187,255,0.06)',
            boxShadow: '0 0 24px rgba(72,187,255,0.22), inset 0 0 16px rgba(72,187,255,0.14)',
            animation: 'monitor-glow 2.9s ease-in-out infinite 0.7s',
            borderRadius: 2,
          }} />
          {/* Activity sub-monitor */}
          <div style={{
            position: 'absolute', right: '6%', top: '20%', width: '10%', height: '6%',
            background: 'rgba(72,187,255,0.05)',
            boxShadow: '0 0 16px rgba(72,187,255,0.18), inset 0 0 10px rgba(72,187,255,0.10)',
            animation: 'monitor-glow 4.2s ease-in-out infinite 2.2s',
            borderRadius: 2,
          }} />
          {/* Forge bottom-left: design workstation */}
          <div style={{
            position: 'absolute', left: '4%', bottom: '7%', width: '15%', height: '9%',
            background: 'rgba(255,178,63,0.06)',
            boxShadow: '0 0 24px rgba(255,178,63,0.22), inset 0 0 16px rgba(255,178,63,0.14)',
            animation: 'monitor-glow 4.6s ease-in-out infinite 1.8s',
            borderRadius: 2,
          }} />
          {/* Forge sub-monitor */}
          <div style={{
            position: 'absolute', left: '7%', bottom: '19%', width: '9%', height: '5%',
            background: 'rgba(255,178,63,0.05)',
            boxShadow: '0 0 14px rgba(255,178,63,0.16)',
            animation: 'monitor-glow 2.8s ease-in-out infinite 3.3s',
            borderRadius: 2,
          }} />
          {/* Treasury bottom-right: finance terminals */}
          <div style={{
            position: 'absolute', right: '4%', bottom: '7%', width: '15%', height: '9%',
            background: 'rgba(255,214,0,0.06)',
            boxShadow: '0 0 24px rgba(255,214,0,0.22), inset 0 0 16px rgba(255,214,0,0.14)',
            animation: 'monitor-glow 3.8s ease-in-out infinite 2.6s',
            borderRadius: 2,
          }} />
          {/* Treasury sub-monitor */}
          <div style={{
            position: 'absolute', right: '7%', bottom: '19%', width: '9%', height: '5%',
            background: 'rgba(255,214,0,0.05)',
            boxShadow: '0 0 14px rgba(255,214,0,0.16)',
            animation: 'monitor-glow 5.1s ease-in-out infinite 0.4s',
            borderRadius: 2,
          }} />
          {/* ELLIE center: leader console glow pulses */}
          <div style={{
            position: 'absolute', left: '36%', top: '35%', width: '12%', height: '8%',
            background: 'rgba(155,114,255,0.05)',
            boxShadow: '0 0 30px rgba(155,114,255,0.20), inset 0 0 20px rgba(155,114,255,0.10)',
            animation: 'monitor-glow 2.4s ease-in-out infinite',
            borderRadius: 3,
          }} />
        </div>

        {/* ── Map legend bottom-left (like reference) ── */}
        <div style={{
          position: 'absolute', left: '1%', bottom: '1%',
          zIndex: 4, pointerEvents: 'none',
          background: 'rgba(1,2,8,0.92)',
          border: '1.5px solid rgba(34,211,164,0.45)',
          borderRadius: 3, padding: '5px 10px',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 0 16px rgba(34,211,164,0.2)',
        }}>
          <div style={{
            fontSize: 7, fontFamily: 'var(--font-mono)', fontWeight: 700,
            color: '#22D3A4', letterSpacing: '0.18em', textTransform: 'uppercase',
            marginBottom: 5, borderBottom: '1px solid rgba(34,211,164,0.25)', paddingBottom: 3,
          }}>◈ ELLIE CORP — MAP LEGEND</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { dot: '#9B72FF', label: 'Leader ELLIE' },
              { dot: '#22D3A4', label: 'Research' },
              { dot: '#48BBFF', label: 'Analysis' },
              { dot: '#FFB23F', label: 'Design' },
              { dot: '#FF6BA8', label: 'Archive' },
              { dot: '#FFD600', label: 'Treasury' },
            ].map(({ dot, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: dot, boxShadow: `0 0 5px ${dot}` }} />
                <span style={{ fontSize: 7, fontFamily: 'var(--font-mono)', color: 'rgba(200,195,230,0.5)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── ELLIE boss at center ── */}
        <EllieOnMap />

        {/* ── Walking agent sprites ── */}
        {MAP_SPRITES.map(spr => (
          <MapWalker
            key={spr.id}
            sprite={spr}
            online={roomStatuses[spr.roomId] === 'online'}
          />
        ))}

        {/* ── Live data mini panels per room ── */}
        <RoomLiveOverlay
          left="2%" top="28%" accent="#22D3A4" accentRgb="34,211,164"
          label="NOVA · SIGNALS"
          value={trends?.trends?.length ?? 0}
          sub={trends?.trends?.[0]?.keyword}
        />
        <RoomLiveOverlay
          left="73%" top="28%" accent="#48BBFF" accentRgb="72,187,255"
          label="OPS · AGENTS"
          value={(status?.agents ?? []).filter(a => a.status === 'online').length + ' live'}
          sub={(status?.agents ?? []).find(a => a.status === 'online')?.name}
        />
        <RoomLiveOverlay
          left="2%" top="80%" accent="#FFB23F" accentRgb="255,178,63"
          label="FORGE · QUEUE"
          value={queue.length}
          sub={forgeProgress?.running ? `⬡ ${forgeProgress.step ?? 'designing'}…` : null}
          blink={forgeProgress?.running}
        />
        <RoomLiveOverlay
          left="30%" top="75%" accent="#FF6BA8" accentRgb="255,107,168"
          label="VAULT · PENDING"
          value={queue.length}
          sub={publishProgress?.running ? '↑ publishing…' : null}
          blink={publishProgress?.running}
        />
        <RoomLiveOverlay
          left="73%" top="80%" accent="#FFD600" accentRgb="255,214,0"
          label="TREASURY"
          value={'$' + Number(spend?.today_usd ?? 0).toFixed(2)}
          sub="today"
        />

        {/* ── Agent room headers (reference-style labels) ── */}
        {AGENT_HEADERS.map((cfg, i) => (
          <AgentRoomHeader
            key={i}
            cfg={cfg}
            isOnline={roomStatuses[cfg.roomId] === 'online'}
          />
        ))}

        {/* ── Room click zones + label chips ── */}
        {MAP_ROOMS.map(room => (
          <MapRoomZone
            key={room.id}
            room={room}
            isOnline={roomStatuses[room.id] === 'online'}
            isAlert={roomStatuses[room.id] === 'alert'}
            onClick={() => setExpanded(room.id)}
          />
        ))}
      </div>

      {/* Always-mounted room modals — state is preserved when closed */}
      <RoomModal icon="🧠" title="ELLIE" visible={expanded === 'ellie'} onClose={() => setExpanded(null)}>
        <EllieRoom
          status={status} activity={activity} onRefresh={fetchAll} onStatusUpdate={setEllieRoomStatus}
          onRunNova={handleRunNovaManual} onRunForge={handleRunForgeManual} onPublishAll={handlePublishAll}
        />
      </RoomModal>
      <RoomModal icon="🔨" title="Forge · Design Room" wide visible={expanded === 'forge'} onClose={() => setExpanded(null)}>
        <ForgeRoom queue={queue} onRun={handleForgeRun} onVerdict={handleVerdict} onRefresh={fetchAll} paused={paused} />
      </RoomModal>
      <RoomModal icon="🔭" title="Nova · Research" visible={expanded === 'nova'} onClose={() => setExpanded(null)}>
        <NovaRoom trends={trends} onRun={handleNovaRun} />
      </RoomModal>
      <RoomModal icon="🗄️" title="Archives" wide visible={expanded === 'archives'} onClose={() => setExpanded(null)}>
        <ArchivesRoom queue={queue} onVerdict={handleVerdict} runs={pipelineRuns} onRerun={handleRerun} />
      </RoomModal>
      <RoomModal icon="💰" title="Treasury" visible={expanded === 'treasury'} onClose={() => setExpanded(null)}>
        <TreasuryRoom spend={spend} />
      </RoomModal>
      <RoomModal icon="📊" title="Activity" visible={expanded === 'activity'} onClose={() => setExpanded(null)}>
        <ActivityRoom status={status} activity={activity} />
      </RoomModal>

      <ProductMakerModal visible={showWorkshop} onClose={() => setShowWorkshop(false)} />
    </RoomShell>
  )
}
