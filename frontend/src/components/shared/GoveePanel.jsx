/**
 * GoveePanel — IoT light control overlay
 *
 * Opened via the 💡 button in the Header (or via ELLIE chat: "open lights").
 * Lets Drew:
 *   - View connected Govee devices
 *   - Test fire any scene
 *   - Toggle IoT sync on/off
 */
import { useState, useEffect, useCallback } from 'react'
import { iotApi } from '../../lib/api'

const mono = "'Share Tech Mono', monospace"
const orb  = "'Orbitron', sans-serif"
const raj  = "'Rajdhani', sans-serif"

const SCENE_LIST = [
  { key: 'idle',         label: 'IDLE',          color: '#002050', desc: 'Deep blue, dim — ambient standby' },
  { key: 'listening',    label: 'LISTENING',      color: '#0064dc', desc: 'Soft blue — ELLIE listening' },
  { key: 'thinking',     label: 'PROCESSING',     color: '#7890ff', desc: 'Blue-white breathe — AI thinking' },
  { key: 'speaking',     label: 'TRANSMITTING',   color: '#00b4ff', desc: 'Cyan pulse — ELLIE responding' },
  { key: 'alert',        label: 'ALERT',          color: '#dc1e1e', desc: 'Red steady — system alert' },
  { key: 'police_alert', label: 'PRIORITY CALL',  color: '#ff0000', desc: 'Red pulse — police priority incident' },
  { key: 'threat_spike', label: 'THREAT SPIKE',   color: '#ff8c00', desc: 'Amber flash — threat level spike' },
]

export default function GoveePanel({ onClose }) {
  const [devices, setDevices]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [firing, setFiring]     = useState(null)
  const [error, setError]       = useState(null)
  const [testResult, setTestResult] = useState(null)

  const loadDevices = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await iotApi.getDevices()
      setDevices(r.data?.devices || [])
    } catch (e) {
      setError('Could not reach Govee API. Check backend configuration.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadDevices() }, [loadDevices])

  const testScene = async (scene) => {
    setFiring(scene)
    setTestResult(null)
    try {
      const r = await iotApi.triggerScene(scene)
      const n = r.data?.devices_updated || 0
      setTestResult(`✓ Scene "${scene}" sent to ${n} device${n !== 1 ? 's' : ''}`)
    } catch {
      setTestResult('✗ Failed to reach Govee — is the backend running?')
    } finally {
      setFiring(null)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,5,12,0.88)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div
        style={{
          background: '#060f1a',
          border: '1px solid rgba(0,212,255,0.3)',
          borderRadius: 6,
          padding: '20px 24px',
          width: 480,
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 0 40px rgba(0,212,255,0.1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: orb, fontSize: 10, letterSpacing: 3, color: '#00d4ff', fontWeight: 700 }}>
              IOT CONTROL LAYER
            </div>
            <div style={{ fontFamily: mono, fontSize: 8, color: 'rgba(180,220,255,0.4)', marginTop: 3, letterSpacing: 1 }}>
              GOVEE SMART LIGHTING · SCENE MANAGEMENT
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: '1px solid rgba(0,212,255,0.2)',
            color: 'rgba(180,220,255,0.5)', cursor: 'pointer',
            fontFamily: mono, fontSize: 11, padding: '3px 10px', borderRadius: 2,
          }}>✕</button>
        </div>

        {/* Device list */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: mono, fontSize: 8, letterSpacing: 2, color: 'rgba(180,220,255,0.5)', marginBottom: 8 }}>
            CONNECTED DEVICES
          </div>
          {loading && (
            <div style={{ fontFamily: mono, fontSize: 9, color: 'rgba(180,220,255,0.3)', letterSpacing: 1 }}>
              SCANNING FOR GOVEE DEVICES...
            </div>
          )}
          {error && (
            <div style={{ fontFamily: mono, fontSize: 9, color: '#ffb300', letterSpacing: 1 }}>
              ⚠ {error}
            </div>
          )}
          {!loading && !error && devices.length === 0 && (
            <div style={{ fontFamily: mono, fontSize: 9, color: 'rgba(180,220,255,0.35)', letterSpacing: 1 }}>
              NO DEVICES FOUND — check API key in backend .env
            </div>
          )}
          {devices.map(d => (
            <div key={d.device} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '6px 10px', borderRadius: 3,
              background: 'rgba(0,212,255,0.04)',
              border: '1px solid rgba(0,212,255,0.1)',
              marginBottom: 5,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00d4ff', boxShadow: '0 0 6px #00d4ff' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: raj, fontSize: 12, color: '#cceeff' }}>{d.deviceName || d.device}</div>
                <div style={{ fontFamily: mono, fontSize: 7, color: 'rgba(180,220,255,0.4)', letterSpacing: 1 }}>{d.model} · {d.device}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Scene test panel */}
        <div>
          <div style={{ fontFamily: mono, fontSize: 8, letterSpacing: 2, color: 'rgba(180,220,255,0.5)', marginBottom: 8 }}>
            SCENE LIBRARY — CLICK TO TEST
          </div>
          {SCENE_LIST.map(s => (
            <div
              key={s.key}
              onClick={() => testScene(s.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '7px 10px', borderRadius: 3,
                background: firing === s.key ? 'rgba(0,212,255,0.08)' : 'rgba(0,212,255,0.02)',
                border: `1px solid ${firing === s.key ? 'rgba(0,212,255,0.4)' : 'rgba(0,212,255,0.1)'}`,
                marginBottom: 5, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,212,255,0.06)'}
              onMouseLeave={e => e.currentTarget.style.background = firing === s.key ? 'rgba(0,212,255,0.08)' : 'rgba(0,212,255,0.02)'}
            >
              <div style={{
                width: 12, height: 12, borderRadius: 2, flexShrink: 0,
                background: s.color,
                boxShadow: `0 0 8px ${s.color}80`,
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: mono, fontSize: 8, color: '#00d4ff', letterSpacing: 1 }}>{s.label}</div>
                <div style={{ fontFamily: raj, fontSize: 10, color: 'rgba(180,220,255,0.5)', marginTop: 1 }}>{s.desc}</div>
              </div>
              {firing === s.key ? (
                <div style={{ fontFamily: mono, fontSize: 7, color: '#00d4ff', letterSpacing: 1 }}>SENDING…</div>
              ) : (
                <div style={{ fontFamily: mono, fontSize: 7, color: 'rgba(0,212,255,0.35)' }}>▶</div>
              )}
            </div>
          ))}
        </div>

        {/* Test result */}
        {testResult && (
          <div style={{
            marginTop: 12, padding: '6px 10px',
            background: testResult.startsWith('✓') ? 'rgba(0,255,157,0.07)' : 'rgba(255,100,0,0.07)',
            border: `1px solid ${testResult.startsWith('✓') ? 'rgba(0,255,157,0.2)' : 'rgba(255,100,0,0.2)'}`,
            borderRadius: 3,
            fontFamily: mono, fontSize: 9, letterSpacing: 1,
            color: testResult.startsWith('✓') ? '#00ff9d' : '#ffb300',
          }}>
            {testResult}
          </div>
        )}

        {/* Footer note */}
        <div style={{
          marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(0,212,255,0.1)',
          fontFamily: mono, fontSize: 7, color: 'rgba(180,220,255,0.25)', letterSpacing: 1, lineHeight: 1.7,
        }}>
          SCENES AUTO-FIRE AS ELLIE STATE CHANGES · POLICE PRIORITY → RED PULSE ·
          ELLIE SPEAKING → CYAN · IDLE → DEEP BLUE
        </div>
      </div>
    </div>
  )
}
