import { useState, useEffect, useRef } from 'react'
import soundEngine from '../../lib/soundEngine'

const mono = "'Share Tech Mono', monospace"
const orb  = "'Orbitron', sans-serif"

// Animated waveform bars — 4 bars that bounce when music is playing
function Waveform({ active }) {
  const bars = [0.4, 0.9, 0.6, 1.0, 0.7, 0.5, 0.85]
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', gap: 2,
      height: 16, width: 24, overflow: 'hidden',
    }}>
      {bars.map((h, i) => (
        <div
          key={i}
          style={{
            width: 2,
            height: active ? `${h * 100}%` : '20%',
            background: active ? '#00d4ff' : 'rgba(0,212,255,0.3)',
            borderRadius: 1,
            transition: 'height 0.3s ease',
            animation: active ? `wave-bar-${i % 4} ${0.5 + i * 0.1}s ease-in-out infinite alternate` : 'none',
          }}
        />
      ))}
      <style>{`
        @keyframes wave-bar-0 { from { height: 20% } to { height: 90% } }
        @keyframes wave-bar-1 { from { height: 35% } to { height: 100% } }
        @keyframes wave-bar-2 { from { height: 25% } to { height: 75% } }
        @keyframes wave-bar-3 { from { height: 40% } to { height: 95% } }
      `}</style>
    </div>
  )
}

export default function AudioControls() {
  const [playing, setPlaying]     = useState(false)
  const [muted, setMuted]         = useState(false)
  const [volume, setVolume]       = useState(0.55)
  const [showVol, setShowVol]     = useState(false)
  const [booted, setBooted]       = useState(false)
  const volTimeout                = useRef(null)

  useEffect(() => {
    // Wire up the engine's state change callback
    soundEngine.onStateChange = (isPlaying) => setPlaying(isPlaying)
    return () => { soundEngine.onStateChange = null }
  }, [])

  // Boot SFX on first mount (after a short delay so user sees the dashboard first)
  useEffect(() => {
    const t = setTimeout(() => {
      soundEngine.startup()
      setBooted(true)
    }, 1800)
    return () => clearTimeout(t)
  }, [])

  const handlePlay = () => {
    soundEngine.click()
    soundEngine.toggleMusic()
  }

  const handleMute = () => {
    soundEngine.click()
    const next = !muted
    setMuted(next)
    soundEngine.setMuted(next)
  }

  const handleVolume = (e) => {
    const v = parseFloat(e.target.value)
    setVolume(v)
    soundEngine.setVolume(v)
    // Show vol slider briefly then hide
    setShowVol(true)
    clearTimeout(volTimeout.current)
    volTimeout.current = setTimeout(() => setShowVol(false), 2000)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '4px 10px',
      background: 'rgba(0,212,255,0.04)',
      border: '1px solid rgba(0,212,255,0.15)',
      borderRadius: 3,
      position: 'relative',
    }}>
      {/* Waveform indicator */}
      <Waveform active={playing && !muted} />

      {/* Play / Pause */}
      <button
        onClick={handlePlay}
        title={playing ? 'Pause music' : 'Play synthwave ambient'}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: playing ? '#00d4ff' : 'rgba(0,212,255,0.5)',
          fontSize: 14, lineHeight: 1, padding: '2px 4px',
          transition: 'color 0.2s',
          display: 'flex', alignItems: 'center',
        }}
      >
        {playing ? (
          // Pause icon
          <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor">
            <rect x="0" y="0" width="4" height="14" rx="1"/>
            <rect x="8" y="0" width="4" height="14" rx="1"/>
          </svg>
        ) : (
          // Play icon
          <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor">
            <polygon points="0,0 12,7 0,14"/>
          </svg>
        )}
      </button>

      {/* Volume / Mute */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          onClick={handleMute}
          onMouseEnter={() => setShowVol(true)}
          onMouseLeave={() => {
            clearTimeout(volTimeout.current)
            volTimeout.current = setTimeout(() => setShowVol(false), 1200)
          }}
          title={muted ? 'Unmute' : 'Mute'}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: muted ? 'rgba(255,59,59,0.7)' : 'rgba(0,212,255,0.6)',
            fontSize: 12, padding: '2px 2px',
            transition: 'color 0.2s',
          }}
        >
          {muted ? '🔇' : volume > 0.5 ? '🔊' : volume > 0.1 ? '🔉' : '🔈'}
        </button>

        {/* Volume slider — appears on hover */}
        <div style={{
          width: showVol ? 70 : 0,
          overflow: 'hidden',
          transition: 'width 0.25s ease',
        }}>
          <input
            type="range"
            min="0" max="1" step="0.02"
            value={volume}
            onChange={handleVolume}
            style={{
              width: 70,
              height: 3,
              accentColor: '#00d4ff',
              cursor: 'pointer',
              background: 'rgba(0,212,255,0.2)',
            }}
          />
        </div>
      </div>

      {/* Label */}
      <span style={{
        fontFamily: mono, fontSize: 8, letterSpacing: 1,
        color: playing ? 'rgba(0,212,255,0.7)' : 'rgba(0,212,255,0.3)',
        transition: 'color 0.3s',
        userSelect: 'none',
      }}>
        {playing ? 'SYNTH' : 'AUDIO'}
      </span>
    </div>
  )
}
