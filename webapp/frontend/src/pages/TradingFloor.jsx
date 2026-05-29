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
    @keyframes tf-ticker   { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
    @keyframes tf-glow     { 0%,100%{opacity:.55;transform:scale(1)} 50%{opacity:.9;transform:scale(1.08)} }
    @keyframes tf-float    { 0%,100%{transform:translate(-50%,-50%) translateY(0)} 50%{transform:translate(-50%,-50%) translateY(-7px)} }
    @keyframes tf-ring     { 0%{opacity:.7;transform:translate(-50%,-50%) scale(.8)} 100%{opacity:0;transform:translate(-50%,-50%) scale(2.2)} }
    @keyframes tf-boot     { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
    @keyframes tf-vine-sway{ 0%,100%{transform-origin:top center;transform:rotate(-1.5deg)} 50%{transform:rotate(1.5deg)} }
    @keyframes tf-wire-flow{ 0%{stroke-dashoffset:80} 100%{stroke-dashoffset:0} }
    @keyframes tf-scan     { 0%{transform:translateY(-100%)} 100%{transform:translateY(400%)} }
    @keyframes tf-slide-in { from{transform:translateX(100%);opacity:0} to{transform:translateX(0);opacity:1} }
    @keyframes tf-blink    { 0%,80%,100%{opacity:1} 90%{opacity:.15} }
    @keyframes tf-pulse    { 0%,100%{opacity:.6} 50%{opacity:1} }
    @keyframes tf-drip     { 0%{height:0;opacity:0} 20%{opacity:.9} 80%{opacity:.5} 100%{height:120%;opacity:0} }
    @keyframes led-blink   { 0%,100%{opacity:1} 50%{opacity:.25} }
    @keyframes tf-node     { 0%{opacity:.7;transform:translate(-50%,-50%) scale(.8)} 100%{opacity:0;transform:translate(-50%,-50%) scale(2)} }
    @keyframes tf-mon-scan { 0%{top:-3px;opacity:0.38} 100%{top:100%;opacity:0} }
  `
  document.head.appendChild(s)
}

// ── CDN helpers ───────────────────────────────────────────────────────────────
const _PL   = 'https://backblaze.pixellab.ai/file/pixellab-characters/c44d0e95-f47c-4c39-96ed-91692c3f5537'
const _DIRS = ['south','east','north','west','south-east','south-west','north-east','north-west']
const _rot  = id => Object.fromEntries(_DIRS.map(d => [d, [`${_PL}/${id}/rotations/${d}.png`]]))
const _anim = (cid, aid, dir, n=8) => Array.from({length:n}, (_,i) => `${_PL}/${cid}/animations/${aid}/${dir}/${i}.png`)

// ── Character IDs ─────────────────────────────────────────────────────────────
const CHAR = {
  quant:  '79f92340-8c3b-47c7-9c3e-5c591aeb0728',
  bull:   'd0016e72-bb3a-44c3-acf2-5604fbf666ea',
  trader: '1eb37793-f1cb-4c5a-a0d8-019a46afa58b',
  risk:   'f3c1eee9-6017-492e-a920-b752dfb082d4',
}
// Walk animation UUIDs — each direction gets its own UUID from Pixellab
// CDN: ${_PL}/${charId}/animations/${uuid}/${dir}/${frameIdx}.png
// Retrieved via get_character() after animate_character completes
const WALK_ANIMS = {
  quant: {
    'south':      'c76f9496-e817-4c8d-8770-fe86c96ee022',
    'east':       'a1209815-e970-41e3-95e5-c780691dfc62',
    'north':      '883757b5-3ee0-413e-9e82-703b869890af',
    'west':       '682bbb5d-1bfd-438b-8ee6-d356309e432c',
    'south-east': 'fba9cef9-38c1-416c-852e-8f330d184b31',
    'north-east': '8aac7990-59d7-4e0d-87df-09a31343a173',
    'north-west': '14eb6f04-8457-4cfa-821d-ad02d777ae49',
    'south-west': '949b7939-c411-48bc-93f3-766968a131fa',
  },
  trader: {
    'south':      'd00aa584-2092-4d74-9fe3-9759627fb4d5',
    'east':       '846ed460-64f2-4982-b26e-59a481003e50',
    'north':      '5241d39f-e631-4972-9665-b6e4f830279e',
    'west':       'cb8e1b65-b784-4e5d-a6af-c0627c9ec953',
    'south-east': '96a4be11-016f-4b4c-8c3b-c03806d4d657',
    'north-east': 'be75d1b2-a8fe-40f7-9fb5-b407bfb3163b',
    'north-west': '9b784b7a-f705-4fff-8e3f-f0b0b6bd73fe',
    'south-west': 'a4e025b9-63d1-4bd3-9647-1bdd35c1726e',
  },
  risk: {
    'south':      '9447c3d9-165c-4858-85ec-ea86b75f21f8',
    'east':       '534ccc48-173a-4a47-baaa-cb35805c556b',
    'north':      '0bcd67c9-928d-4014-a5e8-3ceada23c319',
    'west':       'f8795c5a-8391-4573-a92d-65e982adefb0',
    'south-east': '59d132c1-0964-4669-983c-089e88512f51',
    'north-east': '24c621f8-5ac1-440f-b6c9-7215c7064a39',
    'north-west': 'd687fabe-9402-420d-85af-a8dd6846e317',
    'south-west': '8af7958f-3728-4f31-9e5c-20fb92a4a0fa',
  },
  bull: null,   // queued 2026-05-29 — ~2-4 min, wire UUIDs when get_character returns completed
}

function mkSprite(key, opts) {
  const id    = CHAR[key]
  const anims = WALK_ANIMS[key]   // { [dir]: uuid } or null
  const walkFrames = {}
  _DIRS.forEach(dir => {
    const uuid = anims?.[dir]
    walkFrames[dir] = uuid ? _anim(id, uuid, dir) : []
  })
  return { id, idleFrames: _rot(id), walkFrames, ...opts }
}

// ── 10 patrolling agents (+ ELLIE + Bull = 12 visible characters) ─────────────
const MOVE_MS   = 2800
const SPRITE_SZ = 'clamp(72px, 7vw, 108px)'

const TF_SPRITES = [
  // QUANT POD — 3 agents (left zone)
  mkSprite('quant', {
    label:'QNT-01', taskIcon:'📊', glowColor:'72,187,255', interval:5800,
    path:[{x:'7%',y:'36%'},{x:'16%',y:'31%'},{x:'24%',y:'39%'},{x:'13%',y:'45%'}],
  }),
  mkSprite('quant', {
    label:'QNT-02', taskIcon:'📈', glowColor:'72,187,255', interval:7300,
    path:[{x:'8%',y:'53%'},{x:'20%',y:'56%'},{x:'27%',y:'48%'},{x:'15%',y:'47%'}],
  }),
  mkSprite('quant', {
    label:'QNT-03', taskIcon:'🔬', glowColor:'48,160,255', interval:6400,
    path:[{x:'22%',y:'44%'},{x:'29%',y:'51%'},{x:'22%',y:'60%'},{x:'11%',y:'62%'}],
  }),
  // COMMAND CENTER — 2 agents (center, flanking ELLIE)
  mkSprite('risk', {
    label:'CMD-01', taskIcon:'⚡', glowColor:'155,114,255', interval:9000,
    path:[{x:'37%',y:'31%'},{x:'48%',y:'26%'},{x:'60%',y:'31%'},{x:'50%',y:'38%'}],
  }),
  mkSprite('trader', {
    label:'CMD-02', taskIcon:'💹', glowColor:'200,150,255', interval:8200,
    path:[{x:'36%',y:'58%'},{x:'46%',y:'63%'},{x:'58%',y:'58%'},{x:'44%',y:'54%'}],
  }),
  // RISK DESK — 3 agents (right zone)
  mkSprite('risk', {
    label:'RSK-01', taskIcon:'🛡️', glowColor:'34,211,164', interval:6600,
    path:[{x:'74%',y:'35%'},{x:'83%',y:'31%'},{x:'91%',y:'38%'},{x:'80%',y:'45%'}],
  }),
  mkSprite('risk', {
    label:'RSK-02', taskIcon:'📡', glowColor:'34,211,164', interval:7900,
    path:[{x:'88%',y:'37%'},{x:'94%',y:'45%'},{x:'88%',y:'55%'},{x:'78%',y:'49%'}],
  }),
  mkSprite('risk', {
    label:'RSK-03', taskIcon:'⚠️', glowColor:'50,230,180', interval:5300,
    path:[{x:'76%',y:'57%'},{x:'87%',y:'62%'},{x:'93%',y:'55%'},{x:'82%',y:'49%'}],
  }),
  // EXEC BAY — 2 agents (bottom zone)
  mkSprite('trader', {
    label:'EXC-01', taskIcon:'💰', glowColor:'255,178,63', interval:5100,
    path:[{x:'10%',y:'77%'},{x:'22%',y:'81%'},{x:'36%',y:'77%'},{x:'22%',y:'73%'}],
  }),
  mkSprite('trader', {
    label:'EXC-02', taskIcon:'🔥', glowColor:'255,140,50', interval:6900,
    path:[{x:'54%',y:'82%'},{x:'66%',y:'78%'},{x:'80%',y:'82%'},{x:'66%',y:'86%'}],
  }),
]

// ── Zone definitions ──────────────────────────────────────────────────────────
const ZONES = [
  { id:'quant',   label:'QUANT POD', accent:'#48BBFF', accentRgb:'72,187,255',
    left:'1%',  top:'25%', w:'31%', h:'44%', chipX:'6%',  chipY:'25.5%' },
  { id:'command', label:'COMMAND',   accent:'#9B72FF', accentRgb:'155,114,255',
    left:'33%', top:'21%', w:'34%', h:'48%', chipX:'50%', chipY:'21.5%' },
  { id:'risk',    label:'RISK DESK', accent:'#22D3A4', accentRgb:'34,211,164',
    left:'68%', top:'25%', w:'31%', h:'44%', chipX:'86%', chipY:'25.5%' },
  { id:'exec',    label:'EXEC BAY',  accent:'#FFB23F', accentRgb:'255,178,63',
    left:'1%',  top:'70%', w:'98%', h:'25%', chipX:'50%', chipY:'70.5%' },
]

// ── Desk positions (26 desks total) ──────────────────────────────────────────
const DESKS = [
  // Quant pod — left zone, 3 rows × 2 cols
  { x:'8%',  y:'34%', c:'72,187,255'  }, { x:'20%', y:'31%', c:'72,187,255'  }, { x:'28%', y:'38%', c:'72,187,255'  },
  { x:'8%',  y:'49%', c:'72,187,255'  }, { x:'20%', y:'52%', c:'72,187,255'  }, { x:'28%', y:'58%', c:'72,187,255'  },
  // Command — center zone perimeter (avoid ELLIE@47%,47% and Bull@63%,43%)
  { x:'37%', y:'30%', c:'155,114,255' }, { x:'51%', y:'26%', c:'155,114,255' }, { x:'63%', y:'30%', c:'155,114,255' },
  { x:'36%', y:'57%', c:'155,114,255' }, { x:'51%', y:'62%', c:'155,114,255' }, { x:'64%', y:'57%', c:'155,114,255' },
  // Risk desk — right zone, mirror of quant
  { x:'71%', y:'34%', c:'34,211,164'  }, { x:'81%', y:'31%', c:'34,211,164'  }, { x:'91%', y:'38%', c:'34,211,164'  },
  { x:'71%', y:'49%', c:'34,211,164'  }, { x:'81%', y:'52%', c:'34,211,164'  }, { x:'91%', y:'58%', c:'34,211,164'  },
  // Exec bay — bottom, full width
  { x:'7%',  y:'78%', c:'255,178,63'  }, { x:'19%', y:'75%', c:'255,178,63'  }, { x:'31%', y:'79%', c:'255,178,63'  },
  { x:'43%', y:'75%', c:'255,178,63'  }, { x:'55%', y:'79%', c:'255,178,63'  }, { x:'67%', y:'75%', c:'255,178,63'  },
  { x:'79%', y:'79%', c:'255,178,63'  }, { x:'91%', y:'75%', c:'255,178,63'  },
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

// ── Map decorations — Pixellab pixel-art vines & wires ───────────────────────
const _VINE_X  = ['3%', '20%', '32%', '68%', '80%', '97%']
const _WIRE_X  = ['12%', '26%', '50%', '74%', '88%']

function MapDecor() {
  return (
    <>
      {/* Dark ceiling surface — gradient from top, reveals floor below */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:'24%',
        zIndex:3, pointerEvents:'none',
        background:'linear-gradient(180deg,rgba(1,2,10,0.98) 0%,rgba(3,5,16,0.88) 55%,rgba(3,5,16,0) 100%)' }} />

      {/* Pixellab vine clusters — hanging from ceiling */}
      {_VINE_X.map((left, i) => (
        <img key={`vine-${i}`}
          src="/sprites/trading-floor/vine-cluster.png"
          alt="" draggable={false}
          style={{ position:'absolute', top:0, left,
            transform:`translateX(-50%)${i % 2 === 1 ? ' scaleX(-1)' : ''}`,
            width:56, height:'auto', zIndex:5, pointerEvents:'none',
            imageRendering:'pixelated',
            animation:`tf-vine-sway ${5.5 + i * 0.35}s ease-in-out ${i * 0.55}s infinite`,
            filter:'drop-shadow(0 6px 14px rgba(40,200,80,0.45))' }} />
      ))}

      {/* Pixellab wire bundles — hanging from ceiling conduit brackets */}
      {_WIRE_X.map((left, i) => (
        <img key={`wire-${i}`}
          src="/sprites/trading-floor/wire-bundle.png"
          alt="" draggable={false}
          style={{ position:'absolute', top:0, left,
            transform:'translateX(-50%)',
            width:40, height:'auto', zIndex:5, pointerEvents:'none',
            imageRendering:'pixelated',
            filter:`drop-shadow(0 4px 10px rgba(255,160,0,${0.45 + i * 0.06}))` }} />
      ))}
    </>
  )
}

// ── Desk — office workstation ─────────────────────────────────────────────────
function Desk({ x, y, c }) {
  const [lit, setLit] = useState(() => Math.random() > 0.25)
  useEffect(() => {
    const id = setInterval(() => { if (Math.random() > 0.94) setLit(l => !l) }, 2200)
    return () => clearInterval(id)
  }, [])

  const glow  = `rgba(${c},0.5)`
  const glowD = `rgba(${c},0.22)`

  return (
    <div style={{ position:'absolute', left:x, top:y, transform:'translate(-50%,-50%)',
      width:68, height:62, zIndex:3, pointerEvents:'none' }}>

      {/* Chair — behind desk (bottom) */}
      <div style={{ position:'absolute', bottom:0, left:'50%', transform:'translateX(-50%)',
        width:30, height:20,
        background:'rgba(10,13,28,0.97)',
        border:`1px solid rgba(${c},0.22)`,
        borderRadius:'2px 2px 3px 3px',
        boxShadow:lit ? `0 2px 8px rgba(${c},0.12)` : 'none' }}>
        {/* Chair back */}
        <div style={{ position:'absolute', top:0, left:4, right:4, height:7,
          background:`rgba(${c},0.06)`,
          border:`0.5px solid rgba(${c},0.18)` }} />
      </div>

      {/* Desk surface */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:42,
        background:'rgba(7,9,22,0.98)',
        border:`1px solid rgba(${c},${lit?'0.6':'0.3'})`,
        boxShadow: lit
          ? `0 0 18px rgba(${c},0.25), inset 0 0 12px rgba(${c},0.05), 0 4px 12px rgba(0,0,0,0.6)`
          : `0 4px 12px rgba(0,0,0,0.5)` }}>

        {/* Monitor 1 */}
        <div style={{ position:'absolute', left:4, top:-26, width:26, height:22,
          background: lit ? `rgba(${c},0.82)` : 'rgba(8,10,22,0.97)',
          border:`1.5px solid rgba(${c},${lit?'0.7':'0.25'})`,
          boxShadow: lit ? `0 0 14px ${glow}, 0 0 30px ${glowD}` : 'none',
          overflow:'hidden' }}>
          {/* Screen scanlines */}
          {lit && [4,8,12,17].map(ly => (
            <div key={ly} style={{ position:'absolute', left:1, top:ly, right:1, height:1, background:'rgba(0,0,0,0.35)' }} />
          ))}
          {/* Screen scan sweep */}
          {lit && <div style={{ position:'absolute', left:0, right:0, height:3, background:`rgba(${c},0.3)`,
            animation:'tf-mon-scan 2.4s linear infinite' }} />}
          {/* Status LED */}
          {lit && <div style={{ position:'absolute', right:2, top:2, width:3, height:3, borderRadius:'50%',
            background:`rgb(${c})`, boxShadow:`0 0 4px rgb(${c})`,
            animation:'led-blink 1.8s ease-in-out infinite' }} />}
        </div>

        {/* Monitor 2 */}
        <div style={{ position:'absolute', right:4, top:-26, width:26, height:22,
          background: lit ? `rgba(${c},0.78)` : 'rgba(8,10,22,0.97)',
          border:`1.5px solid rgba(${c},${lit?'0.65':'0.25'})`,
          boxShadow: lit ? `0 0 14px ${glow}, 0 0 28px ${glowD}` : 'none',
          overflow:'hidden' }}>
          {lit && [4,8,12,17].map(ly => (
            <div key={ly} style={{ position:'absolute', left:1, top:ly, right:1, height:1, background:'rgba(0,0,0,0.35)' }} />
          ))}
          {lit && <div style={{ position:'absolute', left:0, right:0, height:3, background:`rgba(${c},0.3)`,
            animation:'tf-mon-scan 3.1s linear infinite' }} />}
          {lit && <div style={{ position:'absolute', right:2, top:2, width:3, height:3, borderRadius:'50%',
            background:`rgb(${c})`, boxShadow:`0 0 4px rgb(${c})`,
            animation:'led-blink 2.3s ease-in-out infinite' }} />}
        </div>

        {/* Monitor stands */}
        <div style={{ position:'absolute', left:14, top:-5, width:5, height:7, background:`rgba(${c},0.22)` }} />
        <div style={{ position:'absolute', right:14, top:-5, width:5, height:7, background:`rgba(${c},0.22)` }} />

        {/* Keyboard */}
        <div style={{ position:'absolute', left:5, bottom:5, right:16, height:10,
          background:`rgba(${c},0.07)`, border:`0.5px solid rgba(${c},0.3)` }}>
          {[2,5,8].map(ky => (
            <div key={ky} style={{ position:'absolute', left:2, top:ky, right:2, height:1, background:`rgba(${c},0.25)` }} />
          ))}
        </div>

        {/* Mouse */}
        <div style={{ position:'absolute', right:4, bottom:5, width:9, height:13,
          background:`rgba(${c},0.12)`, border:`0.5px solid rgba(${c},0.4)`, borderRadius:3 }} />

        {/* Papers */}
        <div style={{ position:'absolute', left:4, top:6, width:14, height:10,
          background:'rgba(22,28,55,0.7)', border:`0.5px solid rgba(${c},0.15)`, transform:'rotate(-4deg)' }} />
      </div>

      {/* Floor shadow */}
      <div style={{ position:'absolute', bottom:-4, left:'10%', right:'10%', height:8,
        background:`radial-gradient(ellipse, rgba(0,0,0,0.5) 0%, transparent 70%)`,
        borderRadius:'50%' }} />
    </div>
  )
}

// ── Zone overlay (clickable) ──────────────────────────────────────────────────
function ZoneOverlay({ zone, active, onClick }) {
  return (
    <div onClick={onClick} style={{
      position:'absolute', left:zone.left, top:zone.top, width:zone.w, height:zone.h,
      border:`1px solid rgba(${zone.accentRgb},${active?'0.55':'0.12'})`,
      background: active ? `rgba(${zone.accentRgb},0.04)` : 'transparent',
      boxShadow: active ? `inset 0 0 60px rgba(${zone.accentRgb},0.05)` : 'none',
      cursor:'pointer', zIndex:2, transition:'all 0.25s',
    }}
    onMouseEnter={e => { if (!active) e.currentTarget.style.background = `rgba(${zone.accentRgb},0.025)` }}
    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
    />
  )
}

// ── Zone chip label ───────────────────────────────────────────────────────────
function ZoneChip({ zone }) {
  return (
    <div style={{ position:'absolute', left:zone.chipX, top:zone.chipY, transform:'translate(-50%,0)',
      zIndex:6, pointerEvents:'none',
      background:'rgba(2,3,10,0.92)', border:`1px solid rgba(${zone.accentRgb},0.55)`,
      padding:'2px 10px', display:'flex', alignItems:'center', gap:5,
      boxShadow:`0 0 12px rgba(${zone.accentRgb},0.2)` }}>
      <div style={{ width:4, height:4, borderRadius:'50%', background:zone.accent, boxShadow:`0 0 6px ${zone.accent}` }} />
      <span style={{ fontSize:6, fontFamily:'var(--font-mono)', fontWeight:700, color:zone.accent,
        letterSpacing:'0.18em', textTransform:'uppercase' }}>{zone.label}</span>
    </div>
  )
}

// ── Live stat mini-overlay ────────────────────────────────────────────────────
function StatChip({ left, top, label, value, color, blink }) {
  return (
    <div style={{ position:'absolute', left, top, zIndex:6, pointerEvents:'none',
      background:'rgba(2,3,10,0.94)', border:`1px solid rgba(${color},0.45)`,
      padding:'4px 9px', minWidth:60, animation:'tf-boot 0.3s ease-out both',
      boxShadow:`0 0 14px rgba(${color},0.2)` }}>
      <div style={{ fontSize:6, fontFamily:'var(--font-mono)', color:`rgba(${color},0.55)`,
        textTransform:'uppercase', letterSpacing:'0.1em' }}>{label}</div>
      <div style={{ fontSize:14, fontFamily:'var(--font-mono)', fontWeight:700, color:`rgb(${color})`,
        lineHeight:1.1, animation:blink ? 'tf-blink 2.5s ease-in-out infinite' : 'none' }}>{value}</div>
    </div>
  )
}

// ── MapWalker sprite ──────────────────────────────────────────────────────────
function MapWalker({ sprite }) {
  // Randomize start position so agents aren't all bunched at path[0]
  const [posIdx, setPosIdx]     = useState(() => Math.floor(Math.random() * sprite.path.length))
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
      setWalking(true)
      setFrameIdx(0)
      setTimeout(() => { if (mountedRef.current) setWalking(false) }, MOVE_MS - 400)
    }, sprite.interval)
    return () => clearInterval(id)
  }, [sprite.interval, sprite.path])

  // Frame cycling — always fall back to idle when walk frames unavailable
  useEffect(() => {
    const walkF = sprite.walkFrames?.[walkDir] ?? []
    const frames = (walking && walkF.length > 0)
      ? walkF
      : (sprite.idleFrames?.[walkDir] ?? sprite.idleFrames?.south ?? [])
    if (!frames.length) return
    const id = setInterval(() => {
      if (mountedRef.current) setFrameIdx(i => (i + 1) % frames.length)
    }, walking && walkF.length > 0 ? 130 : 600)
    return () => clearInterval(id)
  }, [walking, walkDir, sprite.walkFrames, sprite.idleFrames])

  const pos = sprite.path[posIdx]
  const gc  = sprite.glowColor

  // Always show idle rotation for current direction if no walk frames
  const walkF    = sprite.walkFrames?.[walkDir] ?? []
  const hasWalk  = walking && walkF.length > 0
  const dirFrames = hasWalk
    ? walkF
    : (sprite.idleFrames?.[walkDir] ?? sprite.idleFrames?.south ?? [])
  const src = dirFrames.length ? dirFrames[frameIdx % dirFrames.length] : null

  return (
    <div style={{
      position:'absolute', left:pos.x, top:pos.y,
      transform:'translate(-50%,-50%)', zIndex:7, pointerEvents:'none',
      transition:`left ${MOVE_MS}ms cubic-bezier(.45,0,.55,1), top ${MOVE_MS}ms cubic-bezier(.45,0,.55,1)`,
    }}>
      {/* Name chip */}
      <div style={{ position:'absolute', bottom:'100%', left:'50%', transform:'translateX(-50%)',
        whiteSpace:'nowrap', marginBottom:4,
        opacity: walking ? 0 : 1, transition:'opacity 0.4s',
        background:'rgba(2,3,8,0.93)', border:`1px solid rgba(${gc},0.6)`,
        borderRadius:2, padding:'2px 7px',
        display:'flex', alignItems:'center', gap:4 }}>
        <span style={{ fontSize:10 }}>{sprite.taskIcon}</span>
        <span style={{ fontSize:6, fontFamily:'var(--font-mono)', fontWeight:700,
          color:`rgb(${gc})`, letterSpacing:'0.1em', textTransform:'uppercase' }}>{sprite.label}</span>
        <span style={{ width:4, height:4, borderRadius:'50%', background:`rgb(${gc})`,
          boxShadow:`0 0 5px rgb(${gc})`, display:'inline-block', animation:'led-blink 1.2s ease-in-out infinite' }} />
      </div>

      {/* Sprite */}
      <div style={{ width:SPRITE_SZ, height:SPRITE_SZ, position:'relative',
        display:'flex', alignItems:'center', justifyContent:'center' }}>
        {/* Floor shadow pool */}
        <div style={{ position:'absolute', bottom:-6, left:'50%', transform:'translateX(-50%)',
          width:'150%', height:12,
          background:`radial-gradient(ellipse, rgba(${gc},0.45) 0%, transparent 70%)`,
          borderRadius:'50%' }} />
        {src && (
          <img src={src} alt="" draggable={false}
            style={{ width:'100%', height:'100%', objectFit:'contain',
              imageRendering:'pixelated', display:'block',
              filter:`drop-shadow(0 0 6px rgba(${gc},0.9)) drop-shadow(0 3px 8px rgba(${gc},0.4))` }}
            onError={e => { e.currentTarget.src = `${_PL}/${sprite.id}/rotations/south.png` }}
          />
        )}
      </div>
    </div>
  )
}

// ── ELLIE at command center ───────────────────────────────────────────────────
function EllieOnMap() {
  return (
    <div style={{ position:'absolute', left:'47%', top:'47%',
      transform:'translate(-50%,-50%)', zIndex:8, pointerEvents:'none',
      animation:'tf-float 3.5s ease-in-out infinite' }}>
      {/* Floor glow */}
      <div style={{ position:'absolute', bottom:-20, left:'50%', transform:'translateX(-50%)',
        width:240, height:70,
        background:'radial-gradient(ellipse, rgba(155,114,255,0.6) 0%, transparent 70%)',
        animation:'tf-glow 2.4s ease-in-out infinite', borderRadius:'50%' }} />
      {/* Pulse rings */}
      {[0,1].map(i => (
        <div key={i} style={{ position:'absolute', top:'50%', left:'50%',
          width:90, height:90, borderRadius:'50%',
          border:'1.5px solid rgba(155,114,255,0.65)',
          animation:`tf-ring 2.2s ease-out ${i*1.1}s infinite`, pointerEvents:'none' }} />
      ))}
      {/* Name plate */}
      <div style={{ position:'absolute', top:-30, left:'50%', transform:'translateX(-50%)',
        background:'rgba(2,2,10,0.97)', border:'1.5px solid rgba(155,114,255,0.75)',
        padding:'3px 12px', whiteSpace:'nowrap', boxShadow:'0 0 18px rgba(155,114,255,0.4)' }}>
        <span style={{ fontSize:7, fontFamily:'var(--font-mono)', fontWeight:700,
          color:'#9B72FF', letterSpacing:'0.18em', textTransform:'uppercase' }}>⬡ ELLIE · COMMAND</span>
      </div>
      <img
        src="/sprites/EllieSprite/angular_menacing_white_chrome_body_with_dark_biome/rotations/south.png"
        alt="ELLIE" draggable={false}
        style={{ width:'clamp(160px,17vw,250px)', height:'clamp(160px,17vw,250px)',
          objectFit:'contain', imageRendering:'pixelated', display:'block', position:'relative', zIndex:1,
          filter:'drop-shadow(0 0 18px rgba(155,114,255,0.95)) drop-shadow(0 0 36px rgba(155,114,255,0.45))' }}
      />
    </div>
  )
}

// ── The Bull ──────────────────────────────────────────────────────────────────
function BullOnMap() {
  const id = CHAR.bull
  return (
    <div style={{ position:'absolute', left:'63%', top:'43%',
      transform:'translate(-50%,-50%)', zIndex:8, pointerEvents:'none' }}>
      <div style={{ position:'absolute', bottom:-10, left:'50%', transform:'translateX(-50%)',
        width:120, height:36,
        background:'radial-gradient(ellipse, rgba(255,180,0,0.45) 0%, transparent 70%)',
        borderRadius:'50%' }} />
      <div style={{ position:'absolute', top:-26, left:'50%', transform:'translateX(-50%)',
        background:'rgba(2,2,10,0.97)', border:'1.5px solid rgba(255,180,0,0.65)',
        padding:'2px 10px', whiteSpace:'nowrap', boxShadow:'0 0 12px rgba(255,180,0,0.3)' }}>
        <span style={{ fontSize:6, fontFamily:'var(--font-mono)', fontWeight:700,
          color:'#FFB400', letterSpacing:'0.16em', textTransform:'uppercase' }}>⬡ THE BULL</span>
      </div>
      <img src={`${_PL}/${id}/rotations/south.png`} alt="The Bull" draggable={false}
        style={{ width:'clamp(86px,9vw,130px)', height:'clamp(86px,9vw,130px)',
          objectFit:'contain', imageRendering:'pixelated', display:'block',
          filter:'drop-shadow(0 0 12px rgba(255,180,0,0.85)) drop-shadow(0 3px 14px rgba(255,180,0,0.45))' }}
        onError={e => { e.currentTarget.style.display='none' }}
      />
    </div>
  )
}

// ── Jumbotron (top center, embedded in top wall) ──────────────────────────────
function Jumbotron({ snap, orders, loading }) {
  const acct      = snap?.account ?? {}
  const positions = snap?.positions ?? []
  const equity    = acct.portfolio_value ?? acct.equity
  const pnl       = acct.pnl_today
  const pnlPct    = acct.pnl_today_pct
  const fund      = snap?.fund ?? {}
  const active    = fund.active && !fund.paused
  const tickerItems = positions.length ? [...positions, ...positions] : []

  return (
    <div style={{ position:'absolute', left:'11%', top:'1.5%', width:'78%', height:'20%',
      zIndex:4, background:'rgba(1,2,8,0.97)',
      border:'2px solid rgba(255,180,0,0.5)',
      boxShadow:'0 0 50px rgba(255,180,0,0.18), inset 0 0 40px rgba(255,180,0,0.04), 0 0 0 1px rgba(255,180,0,0.08)',
      display:'flex', flexDirection:'column', overflow:'hidden',
      animation:'tf-boot 0.5s ease-out both' }}>

      {/* Bezel top bar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'4px 14px', background:'rgba(0,0,0,0.55)',
        borderBottom:'1px solid rgba(255,180,0,0.2)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:5, height:5, borderRadius:'50%',
            background: active ? '#22D3A4' : '#FF5C72',
            boxShadow: active ? '0 0 6px rgba(34,211,164,0.9)' : 'none',
            animation: active ? 'led-blink 1.5s ease-in-out infinite' : 'none' }} />
          <span style={{ fontSize:6, fontFamily:'var(--font-mono)', fontWeight:700,
            color:'rgba(255,180,0,0.7)', letterSpacing:'0.2em', textTransform:'uppercase' }}>
            ELLIE TRADING FLOOR · MARKET DISPLAY
          </span>
        </div>
        <span style={{ fontSize:6, fontFamily:'var(--font-mono)', fontWeight:700,
          color: active ? '#22D3A4' : '#FF5C72', letterSpacing:'0.1em' }}>
          {active ? '● FUND ACTIVE' : fund.paused ? '⏸ PAUSED' : '○ OFFLINE'}
        </span>
      </div>

      {/* Main data */}
      <div style={{ flex:1, display:'flex', alignItems:'center', padding:'0 16px', gap:24, minHeight:0 }}>
        <div style={{ display:'flex', flexDirection:'column', gap:2, flexShrink:0 }}>
          <span style={{ fontSize:6, fontFamily:'var(--font-mono)', color:'rgba(255,180,0,0.45)',
            textTransform:'uppercase', letterSpacing:'0.12em' }}>Portfolio</span>
          <span style={{ fontSize:26, fontFamily:'var(--font-mono)', fontWeight:700, color:'#FFB400', lineHeight:1,
            animation:'led-blink 3s ease-in-out infinite' }}>
            {loading ? '—' : equity != null ? `$${(+equity).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}` : '—'}
          </span>
        </div>
        <div style={{ width:1, height:'60%', background:'rgba(255,180,0,0.2)' }} />
        <div style={{ display:'flex', flexDirection:'column', gap:2, flexShrink:0 }}>
          <span style={{ fontSize:6, fontFamily:'var(--font-mono)', color:'rgba(255,180,0,0.45)',
            textTransform:'uppercase', letterSpacing:'0.12em' }}>Today P&amp;L</span>
          <span style={{ fontSize:20, fontFamily:'var(--font-mono)', fontWeight:700, color:signColor(pnl), lineHeight:1 }}>
            {loading ? '—' : pnl != null ? `${+pnl>=0?'+':'-'}${$$(pnl)}` : '—'}
          </span>
          {pnlPct != null && (
            <span style={{ fontSize:9, fontFamily:'var(--font-mono)', fontWeight:700, color:signColor(pnl) }}>
              {+pnlPct>=0?'+':''}{(+pnlPct).toFixed(2)}%
            </span>
          )}
        </div>
        <div style={{ width:1, height:'60%', background:'rgba(255,180,0,0.2)' }} />
        <div style={{ display:'flex', flexDirection:'column', gap:2, flexShrink:0 }}>
          <span style={{ fontSize:6, fontFamily:'var(--font-mono)', color:'rgba(255,180,0,0.45)',
            textTransform:'uppercase', letterSpacing:'0.12em' }}>Positions</span>
          <span style={{ fontSize:20, fontFamily:'var(--font-mono)', fontWeight:700, color:'#9B72FF', lineHeight:1 }}>{positions.length}</span>
          <span style={{ fontSize:8, fontFamily:'var(--font-mono)', color:'rgba(170,165,220,0.5)' }}>open</span>
        </div>
        <div style={{ flex:1 }} />
        <div style={{ display:'flex', flexDirection:'column', gap:3, alignItems:'flex-end', flexShrink:0, maxWidth:200 }}>
          {(orders ?? []).slice(0, 3).map((o, i) => {
            const isBuy = o.side === 'buy'
            return (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:6, opacity: 1 - i * 0.3 }}>
                <span style={{ fontSize:7, fontFamily:'var(--font-mono)', fontWeight:700,
                  color: isBuy ? '#22D3A4' : '#FF5C72' }}>{isBuy ? '▲' : '▼'}</span>
                <span style={{ fontSize:8, fontFamily:'var(--font-mono)', fontWeight:700, color:'#E8E4FF' }}>{o.symbol}</span>
                <span style={{ fontSize:7, fontFamily:'var(--font-mono)', color:'rgba(170,165,220,0.5)' }}>{o.status}</span>
              </div>
            )
          })}
          {!orders?.length && !loading && (
            <span style={{ fontSize:7, fontFamily:'var(--font-mono)', color:'rgba(170,165,220,0.3)' }}>no recent orders</span>
          )}
        </div>
      </div>

      {/* Ticker strip */}
      {tickerItems.length > 0 && (
        <div style={{ height:20, overflow:'hidden', background:'rgba(0,0,0,0.45)',
          borderTop:'1px solid rgba(255,180,0,0.15)', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', height:'100%', width:'max-content',
            animation:`tf-ticker ${positions.length * 5}s linear infinite` }}>
            {tickerItems.map((pos, i) => {
              const pl = +(pos.unrealized_pl ?? 0)
              const plpct = +(pos.unrealized_plpc ?? 0) * 100
              const c = signColor(pl)
              return (
                <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:5,
                  padding:'0 16px', borderRight:'1px solid rgba(255,180,0,0.08)',
                  fontFamily:'var(--font-mono)', fontSize:8 }}>
                  <span style={{ color:'#E8E4FF', fontWeight:700 }}>{pos.symbol}</span>
                  <span style={{ color:'#FFB400' }}>${(+pos.current_price).toFixed(2)}</span>
                  <span style={{ color:c, fontWeight:700 }}>{pl >= 0 ? '▲' : '▼'}{Math.abs(plpct).toFixed(2)}%</span>
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
  return (
    <div style={{ display:'flex', alignItems:'center', gap:16, padding:'6px 24px',
      background:'rgba(1,2,8,0.99)', borderBottom:'1px solid rgba(255,180,0,0.18)', flexShrink:0 }}>
      <span style={{ fontSize:7, fontFamily:'var(--font-mono)', color:'rgba(255,180,0,0.45)',
        letterSpacing:'0.2em', textTransform:'uppercase' }}>ELLIE TRADING FLOOR</span>
      <div style={{ width:1, height:14, background:'rgba(255,180,0,0.2)' }} />
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <div style={{ width:5, height:5, borderRadius:'50%',
          background: active ? '#22D3A4' : '#6460A8',
          boxShadow: active ? '0 0 6px rgba(34,211,164,0.8)' : 'none',
          animation: active ? 'led-blink 1.5s ease-in-out infinite' : 'none' }} />
        <span style={{ fontSize:8, fontFamily:'var(--font-mono)', fontWeight:700,
          color: active ? '#22D3A4' : 'rgba(170,165,220,0.45)',
          textTransform:'uppercase', letterSpacing:'0.1em' }}>
          {active ? 'Fund Active' : fund.paused ? 'Fund Paused' : 'Fund Offline'}
        </span>
      </div>
      {acct.cash != null && (
        <>
          <div style={{ width:1, height:14, background:'rgba(255,180,0,0.15)' }} />
          <span style={{ fontSize:8, fontFamily:'var(--font-mono)', color:'rgba(170,165,220,0.5)' }}>
            Cash: <span style={{ color: acct.cash < 0 ? '#FF5C72' : '#48BBFF' }}>
              {acct.cash < 0 ? '-' : ''}{$$(Math.abs(acct.cash))}
            </span>
          </span>
        </>
      )}
      {acct.buying_power != null && (
        <>
          <div style={{ width:1, height:14, background:'rgba(255,180,0,0.15)' }} />
          <span style={{ fontSize:8, fontFamily:'var(--font-mono)', color:'rgba(170,165,220,0.5)' }}>
            Buy Power: <span style={{ color:'rgba(232,228,255,0.7)' }}>{$$(acct.buying_power)}</span>
          </span>
        </>
      )}
      <div style={{ flex:1 }} />
      <button onClick={onRefresh} disabled={refreshing} style={{
        background:'transparent', border:'1px solid rgba(255,180,0,0.3)',
        color: refreshing ? 'rgba(255,180,0,0.3)' : 'rgba(255,180,0,0.6)',
        fontFamily:'var(--font-mono)', fontSize:7, padding:'3px 10px',
        cursor: refreshing ? 'not-allowed' : 'pointer', letterSpacing:'0.1em', textTransform:'uppercase' }}>
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
      <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
        <div style={{ padding:'8px 14px', fontSize:8, fontFamily:'var(--font-mono)',
          color:'rgba(72,187,255,0.55)', borderBottom:'1px solid rgba(72,187,255,0.1)',
          textTransform:'uppercase', letterSpacing:'0.1em' }}>Open Positions</div>
        {!positions.length
          ? <div style={{ padding:16, fontSize:9, fontFamily:'var(--font-mono)', color:'rgba(170,165,220,0.35)', textAlign:'center' }}>— no positions —</div>
          : positions.map((p, i) => {
            const pl = +(p.unrealized_pl ?? 0)
            const plpct = +(p.unrealized_plpc ?? 0) * 100
            return (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 14px', borderBottom:'1px solid rgba(72,187,255,0.06)' }}>
                <span style={{ fontFamily:'var(--font-mono)', fontWeight:700, color:'#E8E4FF', fontSize:11, width:48, flexShrink:0 }}>{p.symbol}</span>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'rgba(170,165,220,0.6)', flex:1 }}>
                  {(+p.qty).toFixed(0)} sh @ ${(+p.avg_entry_price).toFixed(2)}
                </span>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:10, fontWeight:700, color:signColor(pl) }}>
                  {pl >= 0 ? '+' : '-'}{$$(Math.abs(pl))}
                </span>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:signColor(pl) }}>
                  {plpct >= 0 ? '+' : ''}{plpct.toFixed(1)}%
                </span>
              </div>
            )
          })
        }
      </div>
    ),
    command: (
      <div style={{ padding:16, display:'flex', flexDirection:'column', gap:14 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:8, height:8, borderRadius:'50%',
            background: active ? '#22D3A4' : '#6460A8',
            boxShadow: active ? '0 0 10px rgba(34,211,164,0.8)' : 'none',
            animation: active ? 'led-blink 1.5s ease-in-out infinite' : 'none' }} />
          <span style={{ fontFamily:'var(--font-mono)', fontSize:10, fontWeight:700,
            color: active ? '#22D3A4' : 'rgba(170,165,220,0.45)' }}>
            {loading ? 'CONNECTING…' : active ? 'FUND ACTIVE' : fund.paused ? 'FUND PAUSED' : 'FUND OFFLINE'}
          </span>
        </div>
        {[
          ['STYLE',    (fund.investment_style ?? '—').toUpperCase()],
          ['POSITION', fund.position_pct != null ? `${(fund.position_pct*100).toFixed(0)}%` : '—'],
          ['MAX POS',  fund.max_position_pct != null ? `${(fund.max_position_pct*100).toFixed(0)}%` : '—'],
          ['MIN HOLD', fund.min_hold_days != null ? `${fund.min_hold_days}d` : '—'],
        ].map(([k,v]) => (
          <div key={k} style={{ display:'flex', justifyContent:'space-between',
            padding:'7px 0', borderBottom:'1px solid rgba(155,114,255,0.1)' }}>
            <span style={{ fontSize:8, fontFamily:'var(--font-mono)', color:'rgba(170,165,220,0.45)',
              textTransform:'uppercase', letterSpacing:'0.1em' }}>{k}</span>
            <span style={{ fontSize:11, fontFamily:'var(--font-mono)', fontWeight:700, color:'#9B72FF' }}>{v}</span>
          </div>
        ))}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:4 }}>
          {!active && (
            <button onClick={async () => { setBusy(true); await onLaunch(); setBusy(false) }}
              disabled={busy || loading}
              style={{ background:'rgba(34,211,164,0.1)', border:'1px solid rgba(34,211,164,0.55)',
                color:'#22D3A4', fontFamily:'var(--font-mono)', fontWeight:700, fontSize:8,
                padding:'7px 14px', cursor: busy || loading ? 'not-allowed' : 'pointer',
                textTransform:'uppercase', letterSpacing:'0.1em', opacity: busy || loading ? 0.5 : 1 }}>
              ▶ LAUNCH
            </button>
          )}
          {active && (
            <button onClick={async () => { setBusy(true); await onPause(); setBusy(false) }}
              disabled={busy || loading}
              style={{ background:'rgba(255,178,63,0.1)', border:'1px solid rgba(255,178,63,0.55)',
                color:'#FFB23F', fontFamily:'var(--font-mono)', fontWeight:700, fontSize:8,
                padding:'7px 14px', cursor: busy || loading ? 'not-allowed' : 'pointer',
                textTransform:'uppercase', letterSpacing:'0.1em', opacity: busy || loading ? 0.5 : 1 }}>
              ⏸ PAUSE
            </button>
          )}
        </div>
        <div>
          <div style={{ fontSize:7, fontFamily:'var(--font-mono)', color:'rgba(155,114,255,0.5)',
            textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:8 }}>RECENT ACTIVITY</div>
          {(log ?? []).slice(0, 6).map((e, i) => {
            const msg = e.message ?? e.detail ?? e.description ?? JSON.stringify(e)
            const ts  = e.timestamp ?? e.created_at
            return (
              <div key={i} style={{ display:'flex', gap:8, padding:'5px 0',
                borderBottom:'1px solid rgba(155,114,255,0.06)' }}>
                <div style={{ width:4, height:4, borderRadius:'50%', background:'#9B72FF', flexShrink:0, marginTop:4 }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'rgba(232,228,255,0.75)', lineHeight:1.4 }}>{msg}</div>
                  {ts && <div style={{ fontSize:7, fontFamily:'var(--font-mono)', color:'rgba(170,165,220,0.3)', marginTop:1 }}>{timeAgo(ts)}</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    ),
    risk: (
      <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
        <div style={{ padding:'8px 14px', fontSize:8, fontFamily:'var(--font-mono)',
          color:'rgba(34,211,164,0.55)', borderBottom:'1px solid rgba(34,211,164,0.1)',
          textTransform:'uppercase', letterSpacing:'0.1em' }}>Risk Metrics</div>
        {[
          ['Cash', acct.cash != null ? (acct.cash < 0 ? `-${$$(Math.abs(acct.cash))}` : $$(acct.cash)) : '—', acct.cash < 0 ? '#FF5C72' : '#48BBFF'],
          ['Buying Power', acct.buying_power != null ? $$(acct.buying_power) : '—', 'rgba(232,228,255,0.8)'],
          ['Open Positions', positions.length, '#22D3A4'],
          ['Backlog Items', backlog?.length ?? 0, backlog?.length > 0 ? '#FFB23F' : 'rgba(170,165,220,0.55)'],
        ].map(([k,v,c]) => (
          <div key={k} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
            padding:'12px 14px', borderBottom:'1px solid rgba(34,211,164,0.06)' }}>
            <span style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'rgba(170,165,220,0.5)',
              textTransform:'uppercase', letterSpacing:'0.08em' }}>{k}</span>
            <span style={{ fontSize:14, fontFamily:'var(--font-mono)', fontWeight:700, color:c }}>{v}</span>
          </div>
        ))}
        {backlog?.length > 0 && (
          <>
            <div style={{ padding:'8px 14px', fontSize:8, fontFamily:'var(--font-mono)',
              color:'rgba(255,178,63,0.55)', borderBottom:'1px solid rgba(255,178,63,0.1)',
              borderTop:'1px solid rgba(34,211,164,0.08)', textTransform:'uppercase', letterSpacing:'0.1em' }}>Buy Backlog</div>
            {backlog.slice(0,5).map((item,i) => (
              <div key={i} style={{ display:'flex', gap:8, alignItems:'center', padding:'8px 14px',
                borderBottom:'1px solid rgba(255,178,63,0.06)' }}>
                <div style={{ width:4, height:4, borderRadius:'50%', background:'#FFB23F',
                  boxShadow:'0 0 4px rgba(255,178,63,0.7)', animation:'led-blink 1.5s ease-in-out infinite' }} />
                <span style={{ fontFamily:'var(--font-mono)', fontSize:10, fontWeight:700, color:'#E8E4FF', flex:1 }}>
                  {item.ticker ?? item.symbol ?? '?'}
                </span>
                {item.notional && <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'#FFB400' }}>
                  ${(+item.notional).toFixed(2)}
                </span>}
              </div>
            ))}
          </>
        )}
      </div>
    ),
    exec: (
      <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
        <div style={{ padding:'8px 14px', fontSize:8, fontFamily:'var(--font-mono)',
          color:'rgba(255,178,63,0.55)', borderBottom:'1px solid rgba(255,178,63,0.1)',
          textTransform:'uppercase', letterSpacing:'0.1em' }}>Recent Orders</div>
        {!(orders ?? []).length
          ? <div style={{ padding:16, fontSize:9, fontFamily:'var(--font-mono)', color:'rgba(170,165,220,0.35)', textAlign:'center' }}>— no orders —</div>
          : (orders ?? []).slice(0,12).map((o,i) => {
            const isBuy = o.side === 'buy'
            const sc = o.status === 'filled' ? '#22D3A4' : o.status === 'canceled' ? '#FF5C72' : '#FFB23F'
            return (
              <div key={i} style={{ display:'flex', gap:8, alignItems:'center', padding:'9px 14px',
                borderBottom:'1px solid rgba(255,178,63,0.06)' }}>
                <div style={{ width:30, height:16, display:'flex', alignItems:'center', justifyContent:'center',
                  background: isBuy ? 'rgba(34,211,164,0.12)' : 'rgba(255,92,114,0.12)',
                  border:`1px solid ${isBuy ? 'rgba(34,211,164,0.5)' : 'rgba(255,92,114,0.5)'}`,
                  fontSize:6, fontFamily:'var(--font-mono)', fontWeight:700,
                  color: isBuy ? '#22D3A4' : '#FF5C72', flexShrink:0 }}>
                  {isBuy ? 'BUY' : 'SELL'}
                </div>
                <span style={{ fontFamily:'var(--font-mono)', fontWeight:700, color:'#E8E4FF', fontSize:10, width:44, flexShrink:0 }}>{o.symbol}</span>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'rgba(170,165,220,0.55)', flex:1 }}>
                  {o.filled_qty ? `${(+o.filled_qty).toFixed(2)} sh` : o.notional ? `$${(+o.notional).toFixed(0)}` : '—'}
                </span>
                <span style={{ fontSize:7, fontFamily:'var(--font-mono)', fontWeight:700, color:sc, textTransform:'uppercase' }}>{o.status}</span>
              </div>
            )
          })
        }
      </div>
    ),
  }

  return (
    <div style={{ position:'absolute', right:0, top:0, bottom:0, width:320,
      background:'rgba(1,2,8,0.98)', borderLeft:`1px solid rgba(${zone.accentRgb},0.4)`,
      zIndex:20, display:'flex', flexDirection:'column',
      boxShadow:`-24px 0 70px rgba(0,0,0,0.85)`,
      animation:'tf-slide-in 0.25s ease-out both' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'10px 14px', borderBottom:`1px solid rgba(${zone.accentRgb},0.25)`,
        background:'rgba(0,0,0,0.4)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:6, height:6, background:zone.accent, boxShadow:`0 0 8px ${zone.accent}` }} />
          <span style={{ fontSize:9, fontFamily:'var(--font-mono)', fontWeight:700, color:zone.accent,
            textTransform:'uppercase', letterSpacing:'0.15em' }}>{zone.label}</span>
        </div>
        <button onClick={onClose} style={{ background:'transparent', border:'none',
          color:'rgba(170,165,220,0.5)', fontSize:14, cursor:'pointer', padding:'2px 6px', lineHeight:1 }}>✕</button>
      </div>
      <div style={{ flex:1, overflowY:'auto' }}>{content[zone.id]}</div>
    </div>
  )
}

// ── Main trading floor map ────────────────────────────────────────────────────
function TradingFloorMap({ snap, orders, log, backlog, loading, selectedZone, onZoneClick }) {
  const acct = snap?.account ?? {}

  return (
    <div style={{
      position:'relative', flex:1, overflow:'hidden',
      // Floor — Pixellab obsidian tiles + zone ambient lighting
      background:'rgba(4,5,16,1)',
      backgroundImage:[
        // Zone ambient lighting (subtle floor tinting per zone) — drawn over tile texture
        'radial-gradient(ellipse 34% 50% at 15% 52%, rgba(72,187,255,0.10) 0%, transparent 100%)',
        'radial-gradient(ellipse 36% 52% at 50% 47%, rgba(155,114,255,0.12) 0%, transparent 100%)',
        'radial-gradient(ellipse 34% 50% at 85% 52%, rgba(34,211,164,0.10) 0%, transparent 100%)',
        'radial-gradient(ellipse 100% 32% at 50% 82%, rgba(255,178,63,0.10) 0%, transparent 100%)',
        // ELLIE command center glow
        'radial-gradient(circle 180px at 47% 47%, rgba(155,114,255,0.15) 0%, transparent 100%)',
        // Pixellab floor — dark obsidian + amber circuit traces (Wang tileset, 128×128 at 2× scale)
        'url(/sprites/trading-floor/floor-tiles.png)',
      ].join(', '),
      backgroundSize:'cover, cover, cover, cover, cover, 256px 256px',
    }}>

      {/* Zone clickable overlays */}
      {ZONES.map(z => (
        <ZoneOverlay key={z.id} zone={z} active={selectedZone?.id === z.id} onClick={() => onZoneClick(z)} />
      ))}

      {/* Zone label chips */}
      {ZONES.map(z => <ZoneChip key={z.id} zone={z} />)}

      {/* Pixellab map decorations — vines & wires from ceiling */}
      <MapDecor />

      {/* Desk workstations */}
      {DESKS.map((d, i) => <Desk key={i} x={d.x} y={d.y} c={d.c} />)}

      {/* Wall accent strips */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:3, pointerEvents:'none', zIndex:2,
        background:'linear-gradient(90deg,transparent,rgba(255,180,0,0.5),rgba(255,180,0,0.7),rgba(255,180,0,0.5),transparent)' }} />
      <div style={{ position:'absolute', bottom:0, left:0, right:0, height:2, pointerEvents:'none', zIndex:2,
        background:'linear-gradient(90deg,transparent,rgba(255,180,0,0.3),transparent)' }} />
      <div style={{ position:'absolute', left:0, top:0, bottom:0, width:2, pointerEvents:'none', zIndex:2,
        background:'linear-gradient(180deg,rgba(255,180,0,0.4),rgba(255,180,0,0.15),rgba(255,180,0,0.4))' }} />
      <div style={{ position:'absolute', right:0, top:0, bottom:0, width:2, pointerEvents:'none', zIndex:2,
        background:'linear-gradient(180deg,rgba(255,180,0,0.4),rgba(255,180,0,0.15),rgba(255,180,0,0.4))' }} />

      {/* Corner brackets */}
      {[
        { top:4, left:4,  borderTop:'1.5px solid', borderLeft:'1.5px solid' },
        { top:4, right:4, borderTop:'1.5px solid', borderRight:'1.5px solid' },
        { bottom:4, left:4,  borderBottom:'1.5px solid', borderLeft:'1.5px solid' },
        { bottom:4, right:4, borderBottom:'1.5px solid', borderRight:'1.5px solid' },
      ].map((s,i) => (
        <div key={i} style={{ position:'absolute', width:22, height:22,
          ...s, borderColor:'rgba(255,180,0,0.55)', pointerEvents:'none', zIndex:3 }} />
      ))}

      {/* Jumbotron */}
      <Jumbotron snap={snap} orders={orders} loading={loading} />

      {/* Live stat chips */}
      {acct.portfolio_value != null && (
        <StatChip left="2%" top="25.5%" label="P&L Today"
          value={acct.pnl_today != null ? `${+acct.pnl_today>=0?'+':'-'}${$$(Math.abs(acct.pnl_today))}` : '—'}
          color="72,187,255" blink />
      )}
      {acct.buying_power != null && (
        <StatChip left="69%" top="25.5%" label="Buy Power" value={$$(acct.buying_power)} color="34,211,164" />
      )}
      {orders != null && (
        <StatChip left="1.5%" top="70.5%" label="Orders" value={orders.length} color="255,178,63" />
      )}

      {/* Patrolling agent sprites */}
      {TF_SPRITES.map(s => <MapWalker key={`${s.id}-${s.label}`} sprite={s} />)}

      {/* ELLIE — command center */}
      <EllieOnMap />

      {/* The Bull */}
      <BullOnMap />

      {/* Scan line */}
      <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:11, overflow:'hidden', opacity:0.025 }}>
        <div style={{ position:'absolute', left:0, right:0, height:'25%',
          background:'linear-gradient(180deg,transparent,rgba(255,255,255,0.9),transparent)',
          animation:'tf-scan 10s linear infinite' }} />
      </div>

      {/* Drill-down hint */}
      {!selectedZone && (
        <div style={{ position:'absolute', bottom:8, right:12, zIndex:6, pointerEvents:'none',
          fontSize:7, fontFamily:'var(--font-mono)', color:'rgba(170,165,220,0.22)', letterSpacing:'0.1em' }}>
          CLICK ZONE TO DRILL DOWN
        </div>
      )}
    </div>
  )
}

// ── Root component ────────────────────────────────────────────────────────────
export default function TradingFloor() {
  ensureKeyframes()

  const [snap,       setSnap]       = useState(null)
  const [orders,     setOrders]     = useState(null)
  const [log,        setLog]        = useState(null)
  const [backlog,    setBacklog]    = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [zone,       setZone]       = useState(null)
  const mountedRef = useRef(true)
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])

  const fetchAll = useCallback(async (quiet=false) => {
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
  const handleZoneClick = z => setZone(prev => prev?.id === z.id ? null : z)

  return (
    <RoomShell
      title="Trading Floor"
      gradient="linear-gradient(135deg, #FFB23F 0%, #FF8A66 100%)"
      icon="📈"
      outerStyle={{ background:'rgba(1,2,8,0.99)' }}
      contentStyle={{ padding:0, overflow:'hidden', display:'flex', flexDirection:'column' }}
      headerStyle={{ background:'rgba(2,3,10,0.98)', borderBottom:'1px solid rgba(255,180,0,0.25)' }}
    >
      <StatusBar snap={snap} loading={loading} refreshing={refreshing} onRefresh={() => fetchAll(true)} />

      <div style={{ flex:1, position:'relative', display:'flex', minHeight:0 }}>
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
