import { useState, useEffect, useRef } from 'react'
import { usePixellabScene, usePixellabProp, usePixellabSprite } from '../../hooks/usePixellabAsset'

// ─── Per-agent room config ─────────────────────────────────────────────────────
const ROOMS = {
  nova: {
    glow: 'rgba(34,211,164,0.55)',
    bg: {
      delay: 200,
      w: 160, h: 90,
      prompt: 'top-down view pixel art cyberpunk research lab room, dark tiled floor with teal circuit line patterns, back wall with holographic data screens and server towers, bookshelves along side walls, teal neon strip lighting, pixel art RPG game map background, no character, empty center floor area',
    },
    desk: {
      delay: 4000,
      w: 128, h: 80,
      prompt: 'isometric pixel art cyberpunk research workstation desk, triple monitor setup with teal glowing screens, open research books, holographic tablet floating above desk, dark metal desk surface, pixel art game furniture prop, transparent background',
    },
    sprite: {
      delay: 0, size: 120,
      prompt: 'cyberpunk researcher android, teal glowing visor, reading holographic data streams, hooded cloak with circuit patterns, neon teal and black color scheme, pixel art character sprite, facing forward, no background',
    },
  },
  ellie: {
    glow: 'rgba(148,130,255,0.65)',
    bg: {
      delay: 2000,
      w: 160, h: 90,
      staticBg: '/sprites/ellie-room-bg.png',
      prompt: 'top-down view pixel art biopunk cyberpunk central AI nexus chamber, glowing circular bioreactor platform in center, thick organic tube conduits and luminous vines running from all walls to center, bioreactor pods glowing teal violet cyan amber pink gold along each wall, green bioluminescent plant life on walls, dark biometal floor with vein circuit patterns, pixel art RPG game map background, no character',
    },
    desk: {
      delay: 4500,
      staticSrc: '/sprites/ellie-hub-prop.png',
      vCenter: true,  // center bioreactor platform vertically in room
      w: 160, h: 100,
      prompt: '',
    },
    sprite: null,
    staticSrc: '/sprites/ellie-boss.png',  // aggressive biopunk villain boss sprite
    staticW: 160,   // full native width
    staticH: 220,   // full native height — Groot-scale presence
  },
  activity: {
    glow: 'rgba(72,187,255,0.55)',
    bg: {
      delay: 3800,
      w: 160, h: 90,
      prompt: 'top-down view pixel art cyberpunk operations monitoring room, dark grid floor tiles, back wall covered with live data feed screens cyan glow, server rack indicator panels on sides, cyan neon strip lighting, pixel art RPG game map background, no character, empty center floor area',
    },
    desk: {
      delay: 5000,
      staticSrc: '/sprites/prop-activity-desk.png',  // pre-generated monitoring console
      w: 128, h: 80,
      prompt: 'isometric pixel art cyberpunk operations monitoring workstation, curved triple monitor setup with live data feeds cyan glow, ergonomic dark desk, holographic alert indicators, pixel art game furniture prop, transparent background',
    },
    sprite: {
      delay: 600, size: 110,
      prompt: 'operations monitor android, glowing cyan multi-screen visor, data streams floating around body, cyberpunk office drone, blue and white color scheme, pixel art character sprite, facing forward, no background',
    },
  },
  forge: {
    glow: 'rgba(255,178,63,0.55)',
    bg: {
      delay: 5600,
      w: 160, h: 90,
      prompt: 'top-down view pixel art cyberpunk design studio room, dark floor tiles, back wall with large art display screens and digital moodboards amber glow, tool cabinets and equipment racks on sides, amber orange neon lighting, pixel art RPG game map background, no character, empty center floor area',
    },
    desk: {
      delay: 5500,
      w: 128, h: 80,
      prompt: 'isometric pixel art cyberpunk design workstation, large professional drawing tablet with stylus, dual monitors amber glowing with design software UI, art tools holder, dark desk surface, pixel art game furniture prop, transparent background',
    },
    sprite: {
      delay: 1200, size: 120,
      prompt: 'robot designer android, neon orange stylus arm attachment, artist beret, holographic drawing tablet, glowing orange eyes, cyberpunk creative bot, pixel art character sprite, facing forward, no background',
    },
  },
  archives: {
    glow: 'rgba(255,107,168,0.55)',
    bg: {
      delay: 7400,
      w: 160, h: 90,
      prompt: 'top-down view pixel art cyberpunk data archive server room, dark metal tile floor, back wall with tall glowing server racks magenta pink, data storage pods along side walls, pink neon lighting, pixel art RPG game map background, no character, empty center floor area',
    },
    desk: {
      delay: 6000,
      staticSrc: '/sprites/prop-archives-desk.png',  // pre-generated pink neon sorting terminal
      w: 128, h: 80,
      prompt: 'isometric pixel art cyberpunk data archive sorting desk, dual monitors with pink data file displays, holographic filing system floating above, sorting trays, dark desk surface, pixel art game furniture prop, transparent background',
    },
    sprite: {
      delay: 1800, size: 110,
      prompt: 'data archivist android, glowing blue hands, sorting holographic file cards, calm expression, librarian robot, blue and silver trim, cyberpunk, pixel art character sprite, facing forward, no background',
    },
  },
  treasury: {
    glow: 'rgba(255,138,102,0.55)',
    bg: {
      delay: 9200,
      w: 160, h: 90,
      prompt: 'top-down view pixel art cyberpunk finance vault room, dark stone tile floor, back wall with gold credit market displays and encrypted data panels, secure locked cabinets on sides, gold amber neon lighting, pixel art RPG game map background, no character, empty center floor area',
    },
    desk: {
      delay: 6500,
      w: 128, h: 80,
      prompt: 'isometric pixel art cyberpunk finance workstation desk, dual monitors gold glowing with market charts, secure number pad terminal, credit counting display, dark premium desk surface, pixel art game furniture prop, transparent background',
    },
    sprite: {
      delay: 2400, size: 110,
      prompt: 'finance droid android, gold visor, counting holographic credit coins, black and gold trim suit, banking robot, cyberpunk, pixel art character sprite, facing forward, no background',
    },
  },
}

// ─── Walking paths ─────────────────────────────────────────────────────────────
// x = % from left, y = px from bottom, pause = dwell time ms, face = scaleX (1=right -1=left)
// HOME_Y must match DESK_BOTTOM (38) so the sprite starts seated at the desk
const HOME_Y = 38

const WALK_PATHS = {
  nova: [
    { x: 50, y: HOME_Y, pause: 3500, face:  1 },  // desk — seated, scanning hologram
    { x: 30, y: 20,     pause: 4500, face: -1 },  // left bookshelf — reading
    { x: 52, y: 32,     pause: 5000, face:  1 },  // back corner — working
    { x: 68, y: 16,     pause: 3500, face:  1 },  // right server — checking
    { x: 50, y: HOME_Y, pause: 2000, face: -1 },  // desk — reviewing results
  ],
  ellie: [
    { x: 50, y: HOME_Y, pause: 9999999, face: 1 },  // stationary — anchored to nexus bioreactor
  ],
  activity: [
    { x: 50, y: HOME_Y, pause: 6000, face:  1 },  // monitoring console — working at desk
    { x: 22, y: 16,     pause: 3000, face: -1 },  // left data wall — checking feeds
    { x: 50, y: HOME_Y, pause: 3000, face:  1 },  // back at console
    { x: 74, y: 16,     pause: 3000, face:  1 },  // right data wall — checking feeds
    { x: 50, y: HOME_Y, pause: 5000, face: -1 },  // console — analyzing events
  ],
  forge: [
    { x: 50, y: HOME_Y, pause: 2000, face:  1 },  // desk — seated
    { x: 32, y: 24,     pause: 6000, face: -1 },  // drawing tablet — designing
    { x: 50, y: HOME_Y, pause: 1000, face:  1 },  // desk return
    { x: 73, y: 14,     pause: 7000, face:  1 },  // t-shirt press — operating
    { x: 50, y: HOME_Y, pause: 1500, face: -1 },  // desk — inspecting
  ],
  archives: [
    { x: 50, y: HOME_Y, pause: 6000, face:  1 },  // sorting terminal — filing data
    { x: 26, y: 18,     pause: 3500, face: -1 },  // left server rack — retrieving
    { x: 50, y: HOME_Y, pause: 3000, face:  1 },  // back at terminal
    { x: 71, y: 18,     pause: 3500, face:  1 },  // right server rack — retrieving
    { x: 50, y: HOME_Y, pause: 5000, face: -1 },  // terminal — sorting data
  ],
  treasury: [
    { x: 50, y: HOME_Y, pause: 4000, face:  1 },  // desk — counting credits
    { x: 30, y: 16,     pause: 3000, face: -1 },  // left vault
    { x: 50, y: 28,     pause: 3000, face:  1 },  // center — inspecting charts
    { x: 68, y: 16,     pause: 3000, face:  1 },  // right panel
    { x: 50, y: HOME_Y, pause: 3000, face: -1 },  // desk return
  ],
}

const MOVE_DUR = 1350  // sprite transition duration ms

// ─── Global keyframe injection ─────────────────────────────────────────────────
let _keysInjected = false
function ensureKeyframes() {
  if (_keysInjected || typeof document === 'undefined') return
  _keysInjected = true
  const s = document.createElement('style')
  s.textContent = `
    @keyframes shirt-slide {
      0%   { transform: translateX(-90px) scaleX(1); opacity: 0; }
      10%  { opacity: 1; }
      38%  { transform: translateX(0) scaleX(1); }
      62%  { transform: translateX(0) scaleX(1); }
      90%  { opacity: 1; }
      100% { transform: translateX(90px) scaleX(1); opacity: 0; }
    }
    @keyframes press-arm-clamp {
      0%, 32%  { transform: translateY(0); }
      42%, 60% { transform: translateY(16px); }
      70%, 100% { transform: translateY(0); }
    }
    @keyframes heat-glow-pulse {
      0%, 32%  { opacity: 0.2; }
      42%, 60% { opacity: 1; filter: drop-shadow(0 0 6px rgba(255,120,0,0.9)) brightness(1.4); }
      70%, 100% { opacity: 0.2; }
    }
    @keyframes data-packet {
      0%   { transform: translate(-40px, 10px); opacity: 0; }
      15%  { opacity: 0.8; }
      85%  { opacity: 0.8; }
      100% { transform: translate(40px, -10px); opacity: 0; }
    }
    @keyframes credit-coin-float {
      0%   { transform: translateY(0) rotate(0deg); opacity: 0.9; }
      50%  { transform: translateY(-18px) rotate(180deg); opacity: 1; }
      100% { transform: translateY(0) rotate(360deg); opacity: 0.9; }
    }
    @keyframes alert-blink {
      0%, 49%  { opacity: 1; }
      50%, 100% { opacity: 0.1; }
    }
    @keyframes ellie-flow {
      0%   { stroke-dashoffset: 16; }
      100% { stroke-dashoffset: 0; }
    }
    @keyframes ellie-ring-pulse {
      0%, 100% { opacity: 0.35; }
      50%      { opacity: 0.9; }
    }
    @keyframes ellie-orb {
      0%, 100% { opacity: 0.55; }
      50%      { opacity: 1; }
    }
    @keyframes sprite-walk {
      0%, 100% { transform: translateY(0px); }
      20%      { transform: translateY(-6px); }
      60%      { transform: translateY(3px); }
    }
  `
  document.head.appendChild(s)
}

// ─── Sub-components ────────────────────────────────────────────────────────────

// Static pre-generated room background (no API call)
function StaticRoomBg({ src }) {
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        objectFit: 'cover',
        imageRendering: 'pixelated',
        zIndex: 0,
      }}
    />
  )
}

// Dynamic room background — generates via Pixellab API
function DynamicRoomBg({ cfg, glow }) {
  const { src, loading } = usePixellabScene(cfg.prompt, cfg.w, cfg.h, cfg.delay)

  if (src) {
    return (
      <img
        src={src}
        alt=""
        draggable={false}
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover',
          imageRendering: 'pixelated',
          zIndex: 0,
        }}
      />
    )
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 0,
      background: 'linear-gradient(180deg, rgba(6,6,16,1) 0%, rgba(4,5,12,1) 100%)',
      backgroundImage: [
        'linear-gradient(rgba(120,140,220,0.06) 1px, transparent 1px)',
        'linear-gradient(90deg, rgba(120,140,220,0.06) 1px, transparent 1px)',
      ].join(', '),
      backgroundSize: '24px 24px',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at 50% 50%, ${glow.replace('0.55', '0.06')} 0%, transparent 70%)`,
        animation: loading ? 'sprite-pulse 2s ease-in-out infinite' : 'none',
      }} />
    </div>
  )
}

// Dispatcher: uses static asset when available, otherwise generates dynamically
function RoomBg({ cfg, glow }) {
  if (cfg.staticBg) return <StaticRoomBg src={cfg.staticBg} />
  return <DynamicRoomBg cfg={cfg} glow={glow} />
}

const DESK_BOTTOM = 38  // px from container bottom — centers desk in mid-lower area of room

// Static pre-generated desk prop (no API call)
// vCenter=true positions the prop at the vertical center of the room (for ELLIE's bioreactor hub)
function StaticDeskProp({ src, w, h, scale, bottom = DESK_BOTTOM, vCenter = false }) {
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      width={w * scale}
      height={h * scale}
      style={{
        position: 'absolute',
        ...(vCenter
          ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
          : { bottom, left: '50%', transform: 'translateX(-50%)' }
        ),
        imageRendering: 'pixelated',
        zIndex: 2,
        pointerEvents: 'none',
      }}
    />
  )
}

// Dynamic desk prop — generates via Pixellab API
function DynamicDeskProp({ cfg, scale }) {
  const { src } = usePixellabProp(cfg.prompt, cfg.w, cfg.h, cfg.delay)
  if (!src) return null

  return (
    <img
      src={src}
      alt=""
      draggable={false}
      width={cfg.w * scale}
      height={cfg.h * scale}
      style={{
        position: 'absolute',
        bottom: DESK_BOTTOM,
        left: '50%',
        transform: 'translateX(-50%)',
        imageRendering: 'pixelated',
        zIndex: 2,
        pointerEvents: 'none',
      }}
    />
  )
}

// Dispatcher: uses static asset when available, otherwise generates dynamically
function DeskProp({ cfg, scale = 2 }) {
  if (cfg.staticSrc) return <StaticDeskProp src={cfg.staticSrc} w={cfg.w} h={cfg.h} scale={scale} bottom={cfg.propBottom ?? DESK_BOTTOM} vCenter={!!cfg.vCenter} />
  return <DynamicDeskProp cfg={cfg} scale={scale} />
}

function Sprite({ cfg, staticSrc, staticSize, staticW, staticH }) {
  if (staticSrc) {
    // Support separate W/H for non-square sprites (e.g. ELLIE's 160×200 biopunk sprite)
    const w = staticW ?? staticSize ?? 120
    const h = staticH ?? staticSize ?? 120
    return (
      <img
        src={staticSrc}
        width={w}
        height={h}
        alt=""
        draggable={false}
        style={{
          imageRendering: 'pixelated',
          display: 'block',
          animation: 'sprite-bob 2.6s ease-in-out infinite',
          filter: 'drop-shadow(0 0 10px rgba(148,130,255,0.7)) drop-shadow(0 6px 18px rgba(0,0,0,0.9))',
        }}
      />
    )
  }

  const { src, loading, error } = usePixellabSprite(cfg.prompt, cfg.size, cfg.size, cfg.delay)

  if (error) return null

  if (loading || !src) {
    return (
      <div style={{
        width: cfg.size, height: cfg.size,
        borderRadius: 2,
        background: 'transparent',
        animation: 'sprite-pulse 1.8s ease-in-out infinite',
      }} />
    )
  }

  return (
    <img
      src={src}
      width={cfg.size}
      height={cfg.size}
      alt=""
      draggable={false}
      style={{
        imageRendering: 'pixelated',
        display: 'block',
        animation: 'sprite-bob 3s ease-in-out infinite',
        filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.15)) drop-shadow(0 6px 18px rgba(0,0,0,0.9))',
      }}
    />
  )
}

// Walking sprite — moves through its room following WALK_PATHS
// active=false → stays at path[0] (seated at desk); active=true → walks full loop
function WalkingSprite({ agentId, cfg, staticSrc, staticSize, staticW, staticH, active = false }) {
  const path = WALK_PATHS[agentId] || []
  const stepRef = useRef(0)
  const timerRef = useRef(null)
  const walkTimerRef = useRef(null)
  const mountedRef = useRef(true)
  const [step, setStep] = useState(path[0] ?? { x: 50, y: HOME_Y, face: 1 })
  const [walking, setWalking] = useState(false)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (!path.length) return

    // When idle: snap back to home position immediately, no walking
    if (!active) {
      clearTimeout(timerRef.current)
      clearTimeout(walkTimerRef.current)
      stepRef.current = 0
      setWalking(false)
      setStep(path[0])
      return
    }

    function tick() {
      const s = path[stepRef.current % path.length]
      if (!mountedRef.current) return

      // Trigger walk animation for the duration of movement
      setWalking(true)
      clearTimeout(walkTimerRef.current)
      walkTimerRef.current = setTimeout(() => {
        if (mountedRef.current) setWalking(false)
      }, MOVE_DUR)

      setStep(s)
      timerRef.current = setTimeout(() => {
        stepRef.current++
        tick()
      }, MOVE_DUR + s.pause)
    }

    tick()
    return () => {
      clearTimeout(timerRef.current)
      clearTimeout(walkTimerRef.current)
    }
  }, [agentId, active]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      style={{
        position: 'absolute',
        left: `${step.x}%`,
        bottom: step.y,
        transform: `translateX(-50%) scaleX(${step.face ?? 1})`,
        transition: `left ${MOVE_DUR}ms ease-in-out, bottom ${MOVE_DUR}ms ease-in-out`,
        zIndex: 3,
        pointerEvents: 'none',
      }}
    >
      {/* Inner div applies walk bounce without interfering with position transition */}
      <div style={{ animation: walking ? 'sprite-walk 0.24s ease-in-out infinite' : 'none' }}>
        <Sprite cfg={cfg} staticSrc={staticSrc} staticSize={staticSize} staticW={staticW} staticH={staticH} />
      </div>
    </div>
  )
}

// ─── Forge: T-shirt press with conveyor animation ──────────────────────────────
function TshirtPress() {
  ensureKeyframes()

  const { src: pressSrc } = usePixellabProp(
    'isometric pixel art heat press machine, hinged upper heating platen with orange glow, lower conveyor platform, industrial black metal frame, workshop tool, transparent background',
    100, 84,
    9800,
  )
  const { src: shirtSrc } = usePixellabSprite(
    'small pixel art flat t-shirt top view, white shirt with bright orange graphic print, folded neatly, transparent background',
    38, 30,
    10800,
  )

  if (!pressSrc) return null

  return (
    <div style={{
      position: 'absolute',
      right: '18%',
      bottom: 18,
      zIndex: 2,
      pointerEvents: 'none',
    }}>
      <div style={{ position: 'relative', width: 100, height: 84 }}>
        {/* Lower machine body */}
        <img
          src={pressSrc}
          width={100}
          height={84}
          alt=""
          draggable={false}
          style={{ imageRendering: 'pixelated', display: 'block' }}
        />

        {/* Press arm highlight — clamps down on press cycle */}
        <div style={{
          position: 'absolute',
          top: 2, left: 8, right: 8, height: 20,
          background: 'rgba(255,120,0,0.0)',
          animation: 'heat-glow-pulse 6s ease-in-out infinite',
          borderRadius: 2,
          pointerEvents: 'none',
        }} />

        {/* T-shirt sliding through */}
        {shirtSrc && (
          <img
            src={shirtSrc}
            width={38}
            height={30}
            alt=""
            draggable={false}
            style={{
              imageRendering: 'pixelated',
              position: 'absolute',
              bottom: 12,
              left: '50%',
              marginLeft: -19,
              animation: 'shirt-slide 6s linear infinite',
            }}
          />
        )}
      </div>
    </div>
  )
}

// ─── Activity: blinking alert indicator dots ───────────────────────────────────
function AlertDots({ glow }) {
  ensureKeyframes()
  const dots = [
    { left: '18%', bottom: 35, delay: '0s' },
    { left: '78%', bottom: 28, delay: '0.7s' },
    { left: '55%', bottom: 42, delay: '1.4s' },
  ]
  return (
    <>
      {dots.map((d, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: d.left,
          bottom: d.bottom,
          width: 6, height: 6,
          borderRadius: '50%',
          background: glow,
          boxShadow: `0 0 6px ${glow}`,
          animation: `alert-blink 1.2s step-end ${d.delay} infinite`,
          zIndex: 2,
          pointerEvents: 'none',
        }} />
      ))}
    </>
  )
}

// ─── Treasury: floating credit coins ──────────────────────────────────────────
function CreditCoins() {
  ensureKeyframes()
  const coins = [
    { left: '30%', bottom: 55, delay: '0s', dur: '3.1s' },
    { left: '68%', bottom: 45, delay: '1.5s', dur: '2.7s' },
    { left: '50%', bottom: 60, delay: '0.8s', dur: '3.5s' },
  ]
  return (
    <>
      {coins.map((c, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: c.left,
          bottom: c.bottom,
          width: 8, height: 8,
          borderRadius: '50%',
          background: 'rgba(255,200,0,0.85)',
          boxShadow: '0 0 8px rgba(255,200,0,0.6)',
          animation: `credit-coin-float ${c.dur} ease-in-out ${c.delay} infinite`,
          zIndex: 2,
          pointerEvents: 'none',
        }} />
      ))}
    </>
  )
}

// ─── Nova: floating data stream packets ───────────────────────────────────────
function DataPackets() {
  ensureKeyframes()
  const packets = [
    { left: '25%', bottom: 50, delay: '0s', dur: '4s' },
    { left: '60%', bottom: 38, delay: '1.8s', dur: '3.5s' },
    { left: '42%', bottom: 60, delay: '3s', dur: '4.5s' },
  ]
  return (
    <>
      {packets.map((p, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: p.left,
          bottom: p.bottom,
          width: 10, height: 4,
          borderRadius: 2,
          background: 'rgba(34,211,164,0.7)',
          boxShadow: '0 0 6px rgba(34,211,164,0.5)',
          animation: `data-packet ${p.dur} ease-in-out ${p.delay} infinite`,
          zIndex: 2,
          pointerEvents: 'none',
        }} />
      ))}
    </>
  )
}

// ─── ELLIE: biopunk connection hub overlay ────────────────────────────────────
// SVG tubes/vines animated flowing inward from room edges toward ELLIE at center
function EllieConnectionHub() {
  ensureKeyframes()

  // [x1, y1, stroke-color, duration, delay]
  // Lines run from room edges → ELLIE's center position (50%, 50%)
  const connections = [
    ['50%',  '2%',   'rgba(148,130,255,0.55)', '2.4s', '0.0s'],   // North — violet
    ['50%',  '98%',  'rgba(148,130,255,0.45)', '2.9s', '0.6s'],   // South — violet
    ['2%',   '50%',  'rgba(34,211,164,0.50)',  '2.6s', '0.3s'],   // West — teal
    ['98%',  '50%',  'rgba(34,211,164,0.45)',  '2.7s', '0.9s'],   // East — teal
    ['2%',   '2%',   'rgba(100,220,120,0.38)', '3.2s', '0.15s'],  // NW — bio-green
    ['98%',  '2%',   'rgba(200,100,255,0.38)', '3.0s', '1.3s'],   // NE — violet-pink
    ['2%',   '98%',  'rgba(200,100,255,0.32)', '3.5s', '0.75s'],  // SW — violet-pink
    ['98%',  '98%',  'rgba(100,220,120,0.32)', '3.1s', '1.6s'],   // SE — bio-green
  ]

  return (
    <div style={{
      position: 'absolute', inset: 0,
      zIndex: 1,
      pointerEvents: 'none',
      overflow: 'hidden',
    }}>
      <svg
        width="100%" height="100%"
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="ellie-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="1.8" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Animated tube/vine lines flowing from edges toward ELLIE */}
        {connections.map(([x1, y1, color, dur, delay], i) => (
          <line
            key={i}
            x1={x1} y1={y1}
            x2="50%" y2="50%"
            stroke={color}
            strokeWidth="1.5"
            strokeDasharray="6 10"
            filter="url(#ellie-glow)"
            style={{ animation: `ellie-flow ${dur} linear ${delay} infinite` }}
          />
        ))}

        {/* Outer pulsing ring around ELLIE's hub */}
        <circle
          cx="50%" cy="50%"
          r="12%"
          fill="none"
          stroke="rgba(148,130,255,0.38)"
          strokeWidth="1"
          strokeDasharray="4 8"
          style={{ animation: 'ellie-ring-pulse 2.4s ease-in-out 0.2s infinite' }}
        />

        {/* Inner connection ring */}
        <circle
          cx="50%" cy="50%"
          r="6%"
          fill="none"
          stroke="rgba(200,180,255,0.55)"
          strokeWidth="1.5"
          filter="url(#ellie-glow)"
          style={{ animation: 'ellie-ring-pulse 1.8s ease-in-out infinite' }}
        />

        {/* Center nexus orb glow */}
        <circle
          cx="50%" cy="50%"
          r="3%"
          fill="rgba(148,130,255,0.18)"
          stroke="rgba(200,180,255,0.75)"
          strokeWidth="1"
          filter="url(#ellie-glow)"
          style={{ animation: 'ellie-orb 1.5s ease-in-out 0.4s infinite' }}
        />

        {/* Edge node indicators where tubes terminate */}
        {connections.map(([x1, y1, color], i) => (
          <circle
            key={`node-${i}`}
            cx={x1} cy={y1}
            r="2.5"
            fill={color}
            filter="url(#ellie-glow)"
            style={{ animation: `ellie-ring-pulse 2.2s ease-in-out ${i * 0.28}s infinite` }}
          />
        ))}
      </svg>
    </div>
  )
}

// ─── Main export ───────────────────────────────────────────────────────────────
// active=true → sprites walk their full patrol loop (pipeline running)
// active=false → sprites sit at their desk (pipeline idle)
export default function AgentRoom({ agentId, active = false }) {
  const room = ROOMS[agentId]
  if (!room) return null

  const deskScale = agentId === 'ellie' ? 1.75 : 2

  return (
    <>
      {/* Layer 0: pixel art room background */}
      <RoomBg cfg={room.bg} glow={room.glow} />

      {/* Layer 1: dark gradient so top-info text stays readable over any bg */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '55%',
        background: 'linear-gradient(180deg, rgba(2,3,8,0.82) 0%, rgba(2,3,8,0) 100%)',
        pointerEvents: 'none', zIndex: 1,
      }} />

      {/* ELLIE: animated biopunk tube/vine connection hub radiating from center */}
      {agentId === 'ellie' && <EllieConnectionHub />}

      {/* Layer 2: desk prop anchored to mid-lower center of room */}
      <DeskProp cfg={room.desk} scale={deskScale} />

      {/* Forge: t-shirt press on right side */}
      {agentId === 'forge' && <TshirtPress />}

      {/* Activity: alert blinking dots */}
      {agentId === 'activity' && <AlertDots glow={room.glow} />}

      {/* Nova: floating data stream packets */}
      {agentId === 'nova' && <DataPackets />}

      {/* Treasury: floating credit coins */}
      {agentId === 'treasury' && <CreditCoins />}

      {/* Layer 3: agent sprite — seated at desk when idle, walks when active */}
      <WalkingSprite
        agentId={agentId}
        cfg={room.sprite}
        staticSrc={room.staticSrc}
        staticSize={room.staticSize}
        staticW={room.staticW}
        staticH={room.staticH}
        active={active}
      />
    </>
  )
}
