/**
 * EllieAvatar — holographic particle figure
 * Renders inline (no fixed positioning, no physics).
 * Drop it anywhere in the layout — it fills its container.
 */
import { useRef, useEffect, useCallback } from 'react'
import { useEllieStore } from '../../store'

const mono = "'Share Tech Mono', monospace"
const orb  = "'Orbitron', sans-serif"

// Canvas is fixed at these dims; the outer wrapper scales via CSS
const W  = 160
const H  = 280
const CX = W / 2
const CY = H * 0.42
const SCALE = H * 0.36

const BODY = [
  { x: 0,     y: -0.85, rx: 0.11, ry: 0.13, n: 50 },
  { x: 0,     y: -0.69, rx: 0.03, ry: 0.04, n:  8 },
  { x:-0.17,  y: -0.60, rx: 0.06, ry: 0.03, n: 12 },
  { x: 0.17,  y: -0.60, rx: 0.06, ry: 0.03, n: 12 },
  { x: 0,     y: -0.50, rx: 0.15, ry: 0.08, n: 30 },
  { x: 0,     y: -0.34, rx: 0.12, ry: 0.08, n: 24 },
  { x: 0,     y: -0.18, rx: 0.09, ry: 0.06, n: 18 },
  { x:-0.07,  y: -0.05, rx: 0.06, ry: 0.05, n: 10 },
  { x: 0.07,  y: -0.05, rx: 0.06, ry: 0.05, n: 10 },
  { x:-0.23,  y: -0.52, rx: 0.03, ry: 0.07, n: 10 },
  { x: 0.23,  y: -0.52, rx: 0.03, ry: 0.07, n: 10 },
  { x:-0.28,  y: -0.35, rx: 0.025,ry: 0.07, n:  8 },
  { x: 0.28,  y: -0.35, rx: 0.025,ry: 0.07, n:  8 },
  { x:-0.31,  y: -0.21, rx: 0.025,ry: 0.03, n:  5 },
  { x: 0.31,  y: -0.21, rx: 0.025,ry: 0.03, n:  5 },
]

const EYES = [
  { x: -0.045, y: -0.87 },
  { x:  0.045, y: -0.87 },
]

const COL = {
  idle:      { r: 0,   g: 212, b: 255 },
  thinking:  { r: 120, g: 180, b: 255 },
  speaking:  { r: 0,   g: 255, b: 180 },
  alert:     { r: 255, g: 59,  b: 59  },
  listening: { r: 0,   g: 212, b: 255 },
}

const STATE_LABELS = {
  idle:      'STANDBY',
  thinking:  'PROCESSING',
  speaking:  'TRANSMITTING',
  alert:     'ALERT',
  listening: 'LISTENING',
}

function makeParticles() {
  const pts = []
  let id = 0
  BODY.forEach(seg => {
    for (let i = 0; i < seg.n; i++) {
      const a = Math.random() * Math.PI * 2
      const d = Math.sqrt(Math.random())
      pts.push({
        id: id++,
        bx: seg.x + Math.cos(a) * seg.rx * d,
        by: seg.y + Math.sin(a) * seg.ry * d,
        x: 0, y: 0,
        size:      1.0 + Math.random() * 1.2,
        baseAlpha: 0.3 + Math.random() * 0.5,
        alpha: 0,
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.7,
        drift: (Math.random() - 0.5) * 0.005,
      })
    }
  })
  // Ambient floaters
  for (let i = 0; i < 55; i++) {
    pts.push({
      id: id++,
      bx: (Math.random() - 0.5) * 0.8,
      by: -0.1 - Math.random() * 0.85,
      x: 0, y: 0,
      size:      0.5 + Math.random() * 0.8,
      baseAlpha: 0.07 + Math.random() * 0.12,
      alpha: 0,
      phase: Math.random() * Math.PI * 2,
      speed: 0.15 + Math.random() * 0.4,
      drift: (Math.random() - 0.5) * 0.01,
      ambient: true,
    })
  }
  return pts
}

function makeStreams() {
  return Array.from({ length: 18 }, () => ({
    x: CX + (Math.random() - 0.5) * W * 0.5,
    y: H + Math.random() * H,
    speed: 0.5 + Math.random() * 1.4,
    alpha: 0.08 + Math.random() * 0.2,
    length: 4 + Math.random() * 12,
  }))
}

export default function EllieAvatar() {
  const canvasRef  = useRef(null)
  const particles  = useRef(null)
  const streams    = useRef(null)
  const frameRef   = useRef(0)
  const glitchRef  = useRef(0)
  const scanRef    = useRef(0)

  const avatarState = useEllieStore(s => s.ellieAvatarState)
  const stateRef    = useRef(avatarState)
  stateRef.current  = avatarState

  useEffect(() => {
    particles.current = makeParticles()
    streams.current   = makeStreams()
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx   = canvas.getContext('2d')
    const t     = performance.now() * 0.001
    const state = stateRef.current
    const col   = COL[state] || COL.idle

    ctx.clearRect(0, 0, W, H)

    // Base glow
    const bg = ctx.createRadialGradient(CX, H - 10, 4, CX, H - 10, W * 0.6)
    bg.addColorStop(0, `rgba(${col.r},${col.g},${col.b},0.14)`)
    bg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)

    const bodyGlow = ctx.createRadialGradient(CX, CY, 8, CX, CY, SCALE * 0.75)
    bodyGlow.addColorStop(0, `rgba(${col.r},${col.g},${col.b},0.05)`)
    bodyGlow.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = bodyGlow; ctx.fillRect(0, 0, W, H)

    // Glitch
    let gx = 0
    if (t > glitchRef.current) { glitchRef.current = t + 3 + Math.random() * 6; gx = (Math.random()-0.5)*5 }
    const am = state === 'alert' ? Math.sin(t * 8) * 2.5 : 0

    const bAmp = state === 'idle' ? 2.5 : state === 'speaking' ? 4 : 1.5
    const bSpd = state === 'idle' ? 1.2 : state === 'speaking' ? 2.8 : 1.8
    const jit  = state === 'alert' ? 2 : state === 'thinking' ? 0.7 : 0.2
    const aB   = state === 'speaking' ? 0.18 : state === 'alert' ? 0.14 : 0

    // Data streams
    if (state === 'thinking' || state === 'speaking') {
      const st = streams.current || []
      ctx.lineWidth = 1
      st.forEach(s => {
        s.y -= s.speed
        if (s.y < -s.length) { s.y = H + Math.random() * 30; s.x = CX + (Math.random()-0.5)*W*0.5 }
        ctx.strokeStyle = `rgba(${col.r},${col.g},${col.b},${s.alpha})`
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x, s.y + s.length); ctx.stroke()
      })
    }

    // Particles
    const pts = particles.current || []
    pts.forEach(p => {
      const osc  = Math.sin(t * p.speed + p.phase)
      const oscY = Math.cos(t * p.speed * 0.7 + p.phase)
      const bx   = p.bx * bAmp * Math.sin(t * bSpd) * 0.015
      const by   = p.by * bAmp * Math.cos(t * bSpd) * 0.01
      p.x = CX + (p.bx + bx) * SCALE + osc * (p.ambient ? 3.5 : 1.3) + gx + am + (Math.random()-0.5)*jit
      p.y = CY + (p.by + by) * SCALE + oscY * (p.ambient ? 2.5 : 0.9) + p.drift * t * 60
      const flicker    = Math.random() > 0.985 ? 0.2 : 1
      const speakPulse = state === 'speaking' ? 0.5 + 0.5 * Math.sin(t * 6 + p.phase) : 1
      p.alpha = Math.min(1, (p.baseAlpha + aB) * flicker * speakPulse)
      const sz = p.size * (state === 'alert' ? 1.25 : 1)
      ctx.beginPath(); ctx.arc(p.x, p.y, sz, 0, Math.PI*2)
      ctx.fillStyle = `rgba(${col.r},${col.g},${col.b},${p.alpha.toFixed(2)})`; ctx.fill()
      if (sz > 1.2 && p.alpha > 0.3) {
        ctx.beginPath(); ctx.arc(p.x, p.y, sz*2.5, 0, Math.PI*2)
        ctx.fillStyle = `rgba(${col.r},${col.g},${col.b},${(p.alpha*0.1).toFixed(3)})`; ctx.fill()
      }
    })

    // Eyes
    const eSize = state === 'alert' ? 2.6 : 2.0
    const eAlpha = state === 'idle' ? 0.7 + 0.3 * Math.sin(t * 0.8) : 0.9
    if (Math.sin(t * 0.3) <= 0.97) {
      EYES.forEach(e => {
        const ex = CX + e.x * SCALE + gx + am
        const ey = CY + e.y * SCALE
        ctx.beginPath(); ctx.arc(ex, ey, eSize, 0, Math.PI*2)
        ctx.fillStyle = `rgba(255,255,255,${eAlpha.toFixed(2)})`; ctx.fill()
        ctx.beginPath(); ctx.arc(ex, ey, eSize*2.8, 0, Math.PI*2)
        ctx.fillStyle = `rgba(${col.r},${col.g},${col.b},0.12)`; ctx.fill()
      })
    }

    // Thinking ring
    if (state === 'thinking') {
      const ry = CY + (-0.85) * SCALE
      const rr = SCALE * 0.17
      ctx.beginPath(); ctx.arc(CX, ry, rr, t*2%(Math.PI*2), t*2%(Math.PI*2)+Math.PI*1.4)
      ctx.strokeStyle = `rgba(${col.r},${col.g},${col.b},${0.3+0.2*Math.sin(t*3)})`
      ctx.lineWidth = 1.5; ctx.stroke()
      ctx.beginPath(); ctx.arc(CX, ry, rr+4, -(t*1.5%(Math.PI*2)), -(t*1.5%(Math.PI*2))+Math.PI)
      ctx.strokeStyle = `rgba(${col.r},${col.g},${col.b},0.12)`; ctx.lineWidth = 1; ctx.stroke()
    }

    // Speaking waveform
    if (state === 'speaking') {
      ctx.beginPath()
      const wy = CY + (-0.68) * SCALE
      for (let i = 0; i < W; i++) {
        const n = (i - CX) / (W * 0.3)
        const env = Math.exp(-n*n*2)
        const wave = Math.sin(i*0.15 + t*8) * 3.5 * env
        if (i === 0) ctx.moveTo(i, wy+wave); else ctx.lineTo(i, wy+wave)
      }
      ctx.strokeStyle = `rgba(${col.r},${col.g},${col.b},0.22)`; ctx.lineWidth = 1; ctx.stroke()
    }

    // Scanlines
    scanRef.current = (scanRef.current + 0.5) % H
    for (let y = 0; y < H; y += 3) {
      const d = Math.abs(y - scanRef.current)
      ctx.fillStyle = `rgba(${col.r},${col.g},${col.b},${d < 18 ? 0.06*(1-d/18) : 0.01})`
      ctx.fillRect(0, y, W, 1)
    }

    // Base projector line
    const grad = ctx.createLinearGradient(0, H-3, W, H-3)
    grad.addColorStop(0, 'transparent')
    grad.addColorStop(0.3, `rgba(${col.r},${col.g},${col.b},0.35)`)
    grad.addColorStop(0.5, `rgba(${col.r},${col.g},${col.b},0.65)`)
    grad.addColorStop(0.7, `rgba(${col.r},${col.g},${col.b},0.35)`)
    grad.addColorStop(1, 'transparent')
    ctx.fillStyle = grad; ctx.fillRect(0, H-2, W, 2)

    frameRef.current = requestAnimationFrame(draw)
  }, [])

  useEffect(() => {
    frameRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frameRef.current)
  }, [draw])

  const col = COL[avatarState] || COL.idle

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: '#060f1a',
      border: '1px solid rgba(0,212,255,0.2)',
      borderRadius: 4,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Header label */}
      <div style={{
        position: 'absolute', top: 8, left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
        fontFamily: orb, fontSize: 7, letterSpacing: 3,
        color: 'rgba(0,212,255,0.4)',
      }}>ELLIE · AI</div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{
          width: W, height: H,
          filter: `drop-shadow(0 0 10px rgba(${col.r},${col.g},${col.b},0.25))`,
        }}
      />

      {/* State label */}
      <div style={{
        fontFamily: mono,
        fontSize: 7,
        letterSpacing: 2,
        color: `rgba(${col.r},${col.g},${col.b},0.6)`,
        marginTop: -2,
        textShadow: `0 0 5px rgba(${col.r},${col.g},${col.b},0.3)`,
      }}>
        {STATE_LABELS[avatarState] || 'STANDBY'}
      </div>

      {/* Scan line overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,212,255,0.015) 2px, rgba(0,212,255,0.015) 3px)',
      }}/>
    </div>
  )
}
