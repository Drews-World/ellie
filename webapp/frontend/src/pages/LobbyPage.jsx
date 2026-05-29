import { useState, useMemo } from 'react'
import { useUser } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import Mascot from '../components/shared/Mascot'

// ─── Door definitions ─────────────────────────────────────────────────────────
const DOORS = [
  {
    to: '/trading',
    label: 'Trading Floor',
    sublabel: 'Markets & P&L',
    wing: 'WING-A',
    wingCode: '01',
    description: 'Live positions, fund controls, P&L, and daily trade recap.',
    accent: '#FFB400',
    accentRgb: '255,180,0',
    staticScene: '/sprites/lobby-trading.png',
  },
  {
    to: '/business',
    label: 'Business Factory',
    sublabel: 'Agent Crew',
    wing: 'WING-B',
    wingCode: '02',
    description: 'Agent crew status, revenue tracking, and recent actions.',
    accent: '#9B72FF',
    accentRgb: '155,114,255',
    staticScene: '/sprites/lobby-business.png',
  },
  {
    to: '/og',
    label: 'OG Dashboard',
    sublabel: 'World Intel',
    wing: 'WING-C',
    wingCode: '03',
    description: 'World intel, personal mode, prayer, and IoT controls.',
    accent: '#00D4A0',
    accentRgb: '0,212,160',
    staticScene: '/sprites/lobby-og.png',
  },
  {
    to: '/comms',
    label: 'Coming Soon',
    sublabel: 'Comms Bay',
    wing: 'WING-D',
    wingCode: '04',
    description: 'Comms Bay, Treasury, Media Bay, and more rooms on the way.',
    accent: '#FF6B4A',
    accentRgb: '255,107,74',
    disabled: true,
    staticScene: '/sprites/lobby-coming-soon.png',
  },
]

// ─── Keyframe injection ───────────────────────────────────────────────────────
let _keysInjected = false
function ensureKeyframes() {
  if (_keysInjected || typeof document === 'undefined') return
  _keysInjected = true
  const s = document.createElement('style')
  s.textContent = `
    @keyframes door-beacon {
      0%, 100% { opacity: 0.55; transform: scaleX(1); }
      50% { opacity: 1; transform: scaleX(1.05); }
    }
    @keyframes lobby-drift {
      0%   { transform: translateY(0px); }
      50%  { transform: translateY(-5px); }
      100% { transform: translateY(0px); }
    }
    @keyframes star-twinkle {
      0%, 100% { opacity: var(--star-op, 0.5); transform: scale(1); }
      50%       { opacity: calc(var(--star-op, 0.5) * 0.25); transform: scale(0.7); }
    }
    @keyframes lobby-pulse-ring {
      0%   { transform: translate(-50%,-50%) scale(0.8); opacity: 0.7; }
      100% { transform: translate(-50%,-50%) scale(2.4); opacity: 0; }
    }
    @keyframes hub-ring-pulse {
      0%, 100% { opacity: 0.55; transform: scale(1); }
      50%       { opacity: 0.18; transform: scale(1.1); }
    }
    @keyframes lobby-scanline {
      0%   { background-position: 0 0; }
      100% { background-position: 0 4px; }
    }
    @keyframes conduit-drop {
      0%   { transform: translateY(0); opacity: 0; }
      12%  { opacity: 1; }
      88%  { opacity: 1; }
      100% { transform: translateY(22px); opacity: 0; }
    }
    @keyframes map-scan-line {
      0%   { top: 0%; opacity: 0; }
      5%   { opacity: 0.7; }
      95%  { opacity: 0.7; }
      100% { top: 100%; opacity: 0; }
    }
    @keyframes atrium-beam {
      0%   { left: -10%; opacity: 0; }
      8%   { opacity: 1; }
      92%  { opacity: 1; }
      100% { left: 110%; opacity: 0; }
    }
    @keyframes col-flicker {
      0%,90%,100% { opacity: 1; }
      92% { opacity: 0.65; }
      96% { opacity: 0.9; }
    }
  `
  document.head.appendChild(s)
}

// ─── Star field ───────────────────────────────────────────────────────────────
function StarField() {
  ensureKeyframes()
  const stars = useMemo(() => {
    const arr = []
    for (let i = 0; i < 220; i++) {
      const size = Math.random() < 0.72 ? 1 : Math.random() < 0.88 ? 1.5 : 2.5
      const op = 0.22 + Math.random() * 0.68
      arr.push({
        left: Math.random() * 100,
        top:  Math.random() * 78,
        size, op,
        dur:   2.5 + Math.random() * 7,
        delay: Math.random() * 12,
        color: Math.random() < 0.12 ? '#B8AAFF' : Math.random() < 0.08 ? '#88EEFF' : '#FFFFFF',
      })
    }
    return arr
  }, [])
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
      {stars.map((s, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${s.left}%`, top: `${s.top}%`,
          width: s.size, height: s.size,
          borderRadius: '50%',
          background: s.color,
          boxShadow: s.size >= 2 ? `0 0 ${s.size * 2}px ${s.color}` : 'none',
          opacity: s.op,
          '--star-op': s.op,
          animation: `star-twinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
        }} />
      ))}
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'GOOD MORNING'
  if (h < 17) return 'GOOD AFTERNOON'
  return 'GOOD EVENING'
}

// ─── HUD corner bracket ────────────────────────────────────────────────────────
function HudCorner({ v, h, color = 'rgba(255,220,0,0.55)' }) {
  return (
    <div style={{
      position: 'absolute', [v]: -1, [h]: -1,
      width: 22, height: 22, zIndex: 10, pointerEvents: 'none',
      borderTop:    v === 'top'    ? `2px solid ${color}` : 'none',
      borderBottom: v === 'bottom' ? `2px solid ${color}` : 'none',
      borderLeft:   h === 'left'   ? `2px solid ${color}` : 'none',
      borderRight:  h === 'right'  ? `2px solid ${color}` : 'none',
    }} />
  )
}

// ─── Corner terminal indicator ─────────────────────────────────────────────────
function OfficeTerminal({ v, h, label, color }) {
  return (
    <div style={{
      position: 'absolute', [v]: 10, [h]: 16, zIndex: 4,
      padding: '4px 9px',
      border: `1px solid rgba(${color},0.28)`,
      background: `rgba(${color},0.05)`,
      display: 'flex', alignItems: 'center', gap: 5,
      pointerEvents: 'none',
    }}>
      <div style={{
        width: 4, height: 4, borderRadius: '50%',
        background: `rgba(${color},0.7)`,
        boxShadow: `0 0 5px rgba(${color},0.5)`,
        animation: 'led-blink 2.5s ease-in-out infinite',
      }} />
      <span style={{
        fontSize: 6, fontFamily: 'var(--font-mono)',
        color: `rgba(${color},0.52)`,
        letterSpacing: '0.12em', textTransform: 'uppercase',
      }}>{label}</span>
    </div>
  )
}

// ─── Atrium section (top portion of map) ─────────────────────────────────────
function AtriumSection({ firstName }) {
  return (
    <div style={{
      position: 'relative',
      flex: 1,
      minHeight: 110,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundImage: [
        'linear-gradient(rgba(155,114,255,0.055) 1px, transparent 1px)',
        'linear-gradient(90deg, rgba(155,114,255,0.055) 1px, transparent 1px)',
      ].join(','),
      backgroundSize: '34px 34px',
      overflow: 'hidden',
    }}>
      {/* Corner terminals */}
      <OfficeTerminal v="top" h="left"  label="SECURITY" color="155,114,255" />
      <OfficeTerminal v="top" h="right" label="SYSTEMS"  color="34,211,164"  />

      {/* Animated data beams across floor */}
      {[
        { color: '155,114,255', delay: '0s',    dur: '9.2s',  top: '32%' },
        { color: '0,212,160',   delay: '4.1s',  dur: '11.5s', top: '68%' },
        { color: '255,220,0',   delay: '7.3s',  dur: '14.0s', top: '50%' },
      ].map(({ color, delay, dur, top }) => (
        <div key={color + delay} style={{
          position: 'absolute', left: '-10%', top,
          width: '10%', height: 1,
          background: `linear-gradient(90deg, transparent, rgba(${color},0.88), rgba(${color},0.4), transparent)`,
          filter: 'blur(0.6px)',
          boxShadow: `0 0 8px rgba(${color},0.65)`,
          animation: `atrium-beam ${dur} ease-in-out ${delay} infinite`,
          pointerEvents: 'none',
        }} />
      ))}

      {/* Hub radiating lines */}
      <div style={{ position: 'absolute', top: '50%', left: '4%', right: '52%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(155,114,255,0.2))', transform: 'translateY(-0.5px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '50%', left: '52%', right: '4%', height: 1, background: 'linear-gradient(270deg, transparent, rgba(155,114,255,0.2))', transform: 'translateY(-0.5px)', pointerEvents: 'none' }} />

      {/* Central reception hub — Ellie full-body sprite */}
      <div style={{
        width: 148, height: 148, flexShrink: 0,
        borderRadius: '50%',
        border: '1.5px solid rgba(155,114,255,0.48)',
        background: 'radial-gradient(circle, rgba(155,114,255,0.18) 0%, rgba(2,1,10,0.96) 68%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', zIndex: 2,
        boxShadow: '0 0 50px rgba(155,114,255,0.25), 0 0 100px rgba(155,114,255,0.09)',
        overflow: 'hidden',
      }}>
        <img
          src="/sprites/EllieSprite/angular_menacing_white_chrome_body_with_dark_biome/rotations/south.png"
          alt="ELLIE"
          style={{
            width: '90%', height: '90%',
            objectFit: 'contain',
            imageRendering: 'pixelated',
            display: 'block',
            filter: 'drop-shadow(0 0 10px rgba(155,114,255,0.9)) drop-shadow(0 0 28px rgba(155,114,255,0.4))',
          }}
        />
        {/* Outer pulse rings */}
        <div style={{
          position: 'absolute', inset: -22,
          borderRadius: '50%', border: '1px solid rgba(155,114,255,0.22)',
          animation: 'hub-ring-pulse 3.8s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', inset: -42,
          borderRadius: '50%', border: '1px solid rgba(155,114,255,0.1)',
          animation: 'hub-ring-pulse 3.8s ease-in-out 1.9s infinite',
          pointerEvents: 'none',
        }} />
      </div>

      {/* Greeting + atrium label */}
      <div style={{
        position: 'absolute', bottom: 7, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        pointerEvents: 'none',
      }}>
        <div style={{
          fontSize: 7, fontFamily: 'var(--font-pixel)',
          color: 'rgba(255,220,0,0.26)', letterSpacing: '0.18em',
          whiteSpace: 'nowrap',
        }}>◈ CENTRAL ATRIUM ◈</div>
        <div style={{
          fontSize: 7, fontFamily: 'var(--font-mono)',
          color: 'rgba(175,165,230,0.28)', letterSpacing: '0.1em',
          whiteSpace: 'nowrap', textTransform: 'uppercase',
        }}>{getGreeting()}, {firstName} — SELECT DIVISION</div>
      </div>

      {/* Slow vertical scan line */}
      <div style={{
        position: 'absolute', left: 0, right: 0, height: 1.5,
        background: 'linear-gradient(90deg, transparent, rgba(155,114,255,0.16), rgba(255,220,0,0.08), rgba(155,114,255,0.16), transparent)',
        animation: 'map-scan-line 10s linear 3s infinite',
        pointerEvents: 'none', zIndex: 3,
      }} />
    </div>
  )
}

// ─── Single door portal ───────────────────────────────────────────────────────
function LobbyDoor({ door, index }) {
  const navigate = useNavigate()
  const [hov, setHov] = useState(false)
  ensureKeyframes()

  const handleClick = () => { if (!door.disabled) navigate(door.to) }

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        cursor: door.disabled ? 'not-allowed' : 'pointer',
        opacity: door.disabled ? 0.4 : 1,
        transition: 'opacity 0.2s, transform 0.22s',
        transform: hov && !door.disabled ? 'translateY(-6px) scale(1.022)' : 'translateY(0) scale(1)',
        animation: !door.disabled ? `lobby-drift ${3.5 + index * 0.45}s ease-in-out ${index * 0.55}s infinite` : 'none',
      }}
    >
      {/* ── Doorframe ── */}
      <div style={{
        width: 210, height: 265,
        position: 'relative',
        borderRadius: '8px 8px 0 0',
        border: `2px solid ${hov ? door.accent : `rgba(${door.accentRgb},0.55)`}`,
        borderBottom: 'none',
        overflow: 'hidden',
        background: 'rgba(2,2,8,0.5)',
        boxShadow: hov
          ? `0 0 55px rgba(${door.accentRgb},0.7), 0 0 110px rgba(${door.accentRgb},0.25), inset 0 0 40px rgba(${door.accentRgb},0.1)`
          : `0 0 22px rgba(${door.accentRgb},0.3), inset 0 0 14px rgba(${door.accentRgb},0.04)`,
        transition: 'box-shadow 0.38s, border-color 0.38s',
      }}>
        {/* Room scene preview */}
        {door.staticScene && (
          <img
            src={door.staticScene} alt="" draggable={false}
            style={{
              width: '100%', height: '100%',
              objectFit: 'cover', imageRendering: 'pixelated', display: 'block',
              filter: hov ? 'brightness(1.18) saturate(1.15)' : 'brightness(0.72) saturate(0.82)',
              transition: 'filter 0.38s',
            }}
          />
        )}

        {/* CRT scanline overlay */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
          backgroundImage: 'repeating-linear-gradient(transparent 0px, transparent 3px, rgba(0,0,0,0.14) 3px, rgba(0,0,0,0.14) 4px)',
          backgroundSize: '100% 4px',
          animation: 'lobby-scanline 0.18s linear infinite',
        }} />

        {/* Top gradient */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 65,
          background: 'linear-gradient(180deg, rgba(2,3,10,0.94) 0%, transparent 100%)',
          pointerEvents: 'none', zIndex: 3,
        }} />

        {/* Wing badge (top-left) */}
        <div style={{
          position: 'absolute', top: 10, left: 10, zIndex: 5,
          padding: '3px 7px',
          background: `rgba(${door.accentRgb},0.18)`,
          border: `1px solid rgba(${door.accentRgb},0.75)`,
          fontSize: 6, fontFamily: 'var(--font-pixel)',
          color: door.accent, letterSpacing: '0.14em',
          boxShadow: `0 0 8px rgba(${door.accentRgb},0.35)`,
        }}>{door.wing}</div>

        {/* 4-corner pixel brackets */}
        {[['top','left'],['top','right'],['bottom','left'],['bottom','right']].map(([v,h]) => (
          <div key={v+h} style={{
            position: 'absolute', [v]: 6, [h]: 6, width: 12, height: 12, zIndex: 5,
            [`border${v.charAt(0).toUpperCase()+v.slice(1)}`]: `2px solid ${door.accent}`,
            [`border${h.charAt(0).toUpperCase()+h.slice(1)}`]: `2px solid ${door.accent}`,
            opacity: hov ? 1 : 0.4, transition: 'opacity 0.28s',
          }} />
        ))}

        {/* Bottom gradient + label */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 105,
          background: `linear-gradient(0deg, rgba(2,3,10,0.99) 30%, transparent 100%)`,
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          padding: '0 14px 14px', pointerEvents: 'none', zIndex: 4,
        }}>
          <div style={{
            fontSize: 7, fontFamily: 'var(--font-mono)', fontWeight: 700,
            color: door.accent, textTransform: 'uppercase', letterSpacing: '0.22em',
            marginBottom: 3, opacity: 0.75,
          }}>{door.sublabel}</div>
          <div style={{
            fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700,
            color: hov ? '#FFFFFF' : '#D8D0FF',
            textShadow: hov ? `0 0 16px rgba(${door.accentRgb},0.9)` : `0 0 8px rgba(${door.accentRgb},0.4)`,
            transition: 'text-shadow 0.3s, color 0.3s',
          }}>{door.label}</div>
          <div style={{
            fontSize: 9, color: 'rgba(175,170,215,0.48)', marginTop: 4,
            fontFamily: 'var(--font-mono)', lineHeight: 1.45,
          }}>{door.description}</div>
        </div>

        {/* Hover pulse ring */}
        {hov && !door.disabled && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%', zIndex: 6,
            width: 44, height: 44, borderRadius: '50%',
            border: `1px solid rgba(${door.accentRgb},0.85)`,
            animation: 'lobby-pulse-ring 1.3s ease-out infinite',
            pointerEvents: 'none',
          }} />
        )}
      </div>

      {/* ── Door threshold ── */}
      <div style={{
        width: 222, height: 10,
        background: `linear-gradient(90deg, rgba(${door.accentRgb},0.08) 0%, rgba(${door.accentRgb},0.42) 50%, rgba(${door.accentRgb},0.08) 100%)`,
        border: `2px solid ${door.accent}`,
        borderTop: 'none', borderRadius: '0 0 3px 3px',
        position: 'relative',
        boxShadow: `0 4px 24px rgba(${door.accentRgb},0.4)`,
      }}>
        <div style={{
          position: 'absolute', top: '50%', left: '15%', right: '15%', height: 1,
          background: door.accent, opacity: hov ? 1 : 0.5,
          boxShadow: `0 0 8px ${door.accent}`,
          animation: !door.disabled ? `door-beacon 2.8s ease-in-out ${index * 0.55}s infinite` : 'none',
          transition: 'opacity 0.3s',
        }} />
      </div>

      {/* ── Floor reflection ── */}
      <div style={{
        width: 195, height: 12,
        background: `radial-gradient(ellipse at center, rgba(${door.accentRgb},0.5) 0%, transparent 70%)`,
        marginTop: 2, filter: 'blur(4px)',
      }} />

      {/* Enter label */}
      {!door.disabled && (
        <div style={{
          marginTop: 8, minHeight: 18,
          fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
          color: hov ? door.accent : `rgba(${door.accentRgb},0.28)`,
          letterSpacing: '0.2em', textTransform: 'uppercase',
          textShadow: hov ? `0 0 12px ${door.accent}` : 'none',
          transition: 'color 0.28s, text-shadow 0.28s',
        }}>
          {hov ? '▶ enter' : '· · ·'}
        </div>
      )}
    </div>
  )
}

// ─── Full lobby map frame ──────────────────────────────────────────────────────
function LobbyMap({ firstName }) {
  return (
    <div style={{
      flex: 1,
      position: 'relative',
      border: '1.5px solid rgba(155,114,255,0.28)',
      background: 'rgba(2,1,10,0.88)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      minHeight: 460,
    }}>
      {/* HUD corner brackets */}
      <HudCorner v="top"    h="left"  />
      <HudCorner v="top"    h="right" />
      <HudCorner v="bottom" h="left"  />
      <HudCorner v="bottom" h="right" />

      {/* Map meta bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '5px 16px',
        borderBottom: '1px solid rgba(155,114,255,0.14)',
        background: 'rgba(155,114,255,0.04)',
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: 6, fontFamily: 'var(--font-pixel)',
          color: 'rgba(255,220,0,0.3)', letterSpacing: '0.14em', textTransform: 'uppercase',
        }}>◈ ELLIE HUB :: MAIN LOBBY — SECTOR-01</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 5, height: 5, borderRadius: '50%',
            background: 'rgba(0,255,136,0.85)',
            boxShadow: '0 0 6px rgba(0,255,136,0.5)',
            animation: 'led-blink 2s ease-in-out infinite',
          }} />
          <span style={{
            fontSize: 6, fontFamily: 'var(--font-mono)',
            color: 'rgba(0,255,136,0.48)', letterSpacing: '0.1em',
          }}>ALL SYSTEMS NOMINAL</span>
        </div>
      </div>

      {/* Atrium */}
      <AtriumSection firstName={firstName} />

      {/* Wing label strip */}
      <div style={{
        display: 'flex',
        borderTop: '1.5px solid rgba(155,114,255,0.2)',
        borderBottom: '1px solid rgba(155,114,255,0.12)',
        flexShrink: 0,
        background: 'rgba(155,114,255,0.03)',
      }}>
        {DOORS.map((door, i) => (
          <div key={door.to} style={{
            flex: 1, minWidth: 190,
            padding: '7px 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderRight: i < 3 ? `1px solid rgba(${door.accentRgb},0.14)` : 'none',
            background: `rgba(${door.accentRgb},0.03)`,
          }}>
            <span style={{
              fontSize: 7, fontFamily: 'var(--font-mono)', fontWeight: 700,
              color: door.accent, opacity: 0.7,
              letterSpacing: '0.18em', textTransform: 'uppercase',
            }}>{door.wing}</span>
            <span style={{
              fontSize: 6, fontFamily: 'var(--font-pixel)',
              color: `rgba(${door.accentRgb},0.3)`, letterSpacing: '0.1em',
            }}>BAY-{door.wingCode}</span>
          </div>
        ))}
      </div>

      {/* Door bays */}
      <div style={{ display: 'flex', flexShrink: 0 }}>
        {DOORS.map((door, i) => (
          <div key={door.to} style={{
            flex: 1, minWidth: 195,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '14px 6px 20px',
            position: 'relative',
            borderRight: i < 3 ? `1px solid rgba(${door.accentRgb},0.12)` : 'none',
            background: `radial-gradient(ellipse at 50% 60%, rgba(${door.accentRgb},0.06) 0%, transparent 65%)`,
            overflow: 'visible',
          }}>
            {/* Conduit drop line + animated particle */}
            <div style={{
              width: 1, height: 22, flexShrink: 0,
              background: `linear-gradient(180deg, rgba(${door.accentRgb},0.5), rgba(${door.accentRgb},0.1))`,
              marginBottom: 10, position: 'relative',
            }}>
              <div style={{
                position: 'absolute', width: 3, height: 3, borderRadius: '50%',
                background: door.accent, left: -1, top: 0,
                boxShadow: `0 0 6px ${door.accent}`,
                animation: `conduit-drop 2.2s ease-in ${i * 0.55}s infinite`,
              }} />
            </div>

            <LobbyDoor door={door} index={i} />
          </div>
        ))}
      </div>

      {/* Floor threshold */}
      <div style={{
        flexShrink: 0,
        height: 22,
        borderTop: '1px solid rgba(155,114,255,0.14)',
        background: 'linear-gradient(180deg, rgba(155,114,255,0.04) 0%, transparent 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          fontSize: 5, fontFamily: 'var(--font-pixel)',
          color: 'rgba(255,220,0,0.16)', letterSpacing: '0.22em', textTransform: 'uppercase',
        }}>— PUBLIC SECTOR — SECURE ACCESS REQUIRED —</span>
      </div>
    </div>
  )
}

// ─── Lobby page ───────────────────────────────────────────────────────────────
export default function LobbyPage() {
  const { user } = useUser()
  const firstName = user?.firstName || 'Drew'
  ensureKeyframes()

  return (
    <div style={{
      height: '100%', position: 'relative',
      background: 'radial-gradient(ellipse at 50% 30%, #0D0820 0%, #060410 40%, #030308 100%)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>

      {/* ── Background ── */}
      <StarField />
      <div style={{ position: 'absolute', top: '4%', left: '50%', transform: 'translateX(-50%)', width: 1000, height: 550, background: 'radial-gradient(ellipse at center, rgba(155,114,255,0.09) 0%, rgba(100,55,220,0.04) 45%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'absolute', top: '-8%', left: '-6%', width: 520, height: 420, background: 'radial-gradient(ellipse, rgba(34,211,164,0.05) 0%, transparent 65%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'absolute', top: '0%', right: '-4%', width: 440, height: 380, background: 'radial-gradient(ellipse, rgba(255,180,0,0.04) 0%, transparent 65%)', pointerEvents: 'none', zIndex: 0 }} />

      {/* ── CRT overlay ── */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
        backgroundImage: 'repeating-linear-gradient(transparent 0px, transparent 3px, rgba(0,0,0,0.07) 3px, rgba(0,0,0,0.07) 4px)',
        backgroundSize: '100% 4px',
        animation: 'lobby-scanline 0.2s linear infinite',
      }} />

      {/* ── Vignette ── */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none', background: 'radial-gradient(ellipse at center, transparent 45%, rgba(2,1,8,0.65) 100%)' }} />

      {/* ── Content ── */}
      <div style={{ position: 'relative', zIndex: 5, display: 'flex', flexDirection: 'column', height: '100%' }}>

        {/* Compact header */}
        <div style={{ padding: '12px 32px 10px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <img
              src="/sprites/EllieSprite/EllieHeadshot.png" width={38} height={38} alt="ELLIE Corp"
              style={{ objectFit: 'cover', borderRadius: 5, filter: 'drop-shadow(0 0 10px rgba(155,114,255,0.75))' }}
            />
            <div>
              <div style={{ fontSize: 7, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'rgba(255,220,0,0.52)', letterSpacing: '0.24em', textTransform: 'uppercase', lineHeight: 1.5 }}>
                ◈ ELLIE Corp — Secure Lobby Access
              </div>
              <div style={{ fontSize: 6, fontFamily: 'var(--font-mono)', color: 'rgba(155,114,255,0.42)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                Executive Life Logic Intelligence Engine
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(155,114,255,0.45), transparent)' }} />
            <span style={{ fontSize: 6, fontFamily: 'var(--font-pixel)', color: 'rgba(255,220,0,0.22)', letterSpacing: '0.2em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              SECURE FACILITY — MAIN LOBBY
            </span>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(270deg, rgba(155,114,255,0.45), transparent)' }} />
          </div>
        </div>

        {/* Map area */}
        <div style={{
          flex: 1, padding: '0 20px 10px',
          display: 'flex', minHeight: 0, overflow: 'auto',
        }}>
          <LobbyMap firstName={firstName} />
        </div>

        {/* Status bar */}
        <div style={{
          flexShrink: 0,
          display: 'flex', gap: 18, alignItems: 'center',
          padding: '7px 28px',
          background: 'rgba(2,2,10,0.98)',
          borderTop: '1px solid rgba(255,220,0,0.1)',
          backgroundImage: 'repeating-linear-gradient(transparent 0px,transparent 3px,rgba(0,0,0,0.09) 3px,rgba(0,0,0,0.09) 4px)',
          backgroundSize: '100% 4px',
          flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 6, fontFamily: 'var(--font-pixel)', color: 'rgba(255,220,0,0.3)', letterSpacing: '0.2em', textTransform: 'uppercase', marginRight: 6, whiteSpace: 'nowrap' }}>CORP STATUS</span>
          {[
            { label: 'Trading',  value: 'Connect trading server',    color: 'rgba(255,180,0,0.8)'  },
            { label: 'Business', value: 'Factory running on :8001',  color: 'rgba(0,255,136,0.8)'  },
            { label: 'ELLIE',    value: 'Online — Gemini 2.0 Flash', color: 'rgba(255,0,204,0.8)'  },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`, animation: 'led-blink 2s ease-in-out infinite' }} />
              <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
              <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'rgba(155,150,195,0.4)' }}>{value}</span>
            </div>
          ))}
          <div style={{ marginLeft: 'auto' }}>
            <Mascot size={26} />
          </div>
        </div>
      </div>
    </div>
  )
}
