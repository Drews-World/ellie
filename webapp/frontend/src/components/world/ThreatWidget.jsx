import { useEffect } from 'react'
import { useEllieStore } from '../../store'
import { worldApi } from '../../lib/api'
import Widget from '../shared/Widget'

const mono = "'Share Tech Mono', monospace"
const orb  = "'Orbitron', sans-serif"

const SECTORS = [
  { key: 'geopolitical', label: 'GEOPOLITICAL' },
  { key: 'economic',     label: 'ECONOMIC' },
  { key: 'cyber',        label: 'CYBER' },
  { key: 'climate',      label: 'CLIMATE' },
  { key: 'health',       label: 'HEALTH' },
]

function scoreColor(score) {
  if (score >= 70) return '#ff3b3b'
  if (score >= 50) return '#ffb300'
  return '#00ff9d'
}

export default function ThreatWidget() {
  const { threatMatrix, setThreatMatrix } = useEllieStore()

  useEffect(() => {
    if (Object.keys(threatMatrix).length) return
    worldApi.getThreatMatrix().then(r => setThreatMatrix(r.data || {})).catch(() => {})
  }, [])

  return (
    <Widget title="THREAT MATRIX" badge="CLASSIFIED" badgeType="red" widgetKey="threat-monitor" detailTitle="THREAT MATRIX // ELLIE BRIEF">
      {SECTORS.map(({ key, label }) => {
        const sector = threatMatrix[key]
        const score = sector?.score ?? null
        const color = score != null ? scoreColor(score) : 'rgba(180,220,255,0.3)'
        return (
          <div key={key} style={{ padding: '6px 0', borderBottom: '1px solid rgba(95,208,216,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontFamily: mono, fontSize: 9, color: 'rgba(180,220,255,0.6)', letterSpacing: 1 }}>{label}</span>
              <span style={{ fontFamily: orb, fontSize: 9, color, letterSpacing: 1 }}>
                {score != null ? `${score}%` : '—'}
              </span>
            </div>
            {score != null && (
              <div style={{ height: 3, background: 'rgba(95,208,216,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${score}%`,
                  background: color,
                  borderRadius: 2,
                  transition: 'width 0.5s ease',
                }} />
              </div>
            )}
          </div>
        )
      })}
    </Widget>
  )
}
