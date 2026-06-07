import { useEffect, useState, useCallback, useRef } from 'react'
import { worldApi } from '../../lib/api'
import soundEngine from '../../lib/soundEngine'
import { useEllieStore } from '../../store'
import { fireGoveeScene } from '../../lib/govee'

const orb  = "'Orbitron', sans-serif"
const mono = "'Share Tech Mono', monospace"
const raj  = "'Rajdhani', sans-serif"

const REFRESH_MS = 6 * 60 * 60 * 1000   // 6 hours

// Priority groups → color
const PRIORITY_MAP = {
  'PERSON WITH A WEAPON':   { color: '#ff3b3b', badge: 'PRIORITY' },
  'ASSAULT':                { color: '#ff3b3b', badge: 'PRIORITY' },
  'ROBBERY':                { color: '#ff3b3b', badge: 'PRIORITY' },
  'SHOTS':                  { color: '#ff3b3b', badge: 'PRIORITY' },
  'HOMICIDE':               { color: '#ff3b3b', badge: 'PRIORITY' },
  'DISTURBANCE':            { color: '#ffb300', badge: 'ACTIVE' },
  'TRESPASS':               { color: '#ffb300', badge: 'ACTIVE' },
  'SUSPICIOUS PERSON':      { color: '#ffb300', badge: 'ACTIVE' },
  'DUI':                    { color: '#ffb300', badge: 'ACTIVE' },
  'TRAFFIC':                { color: '#5FD0D8', badge: 'TRAFFIC' },
  'ACCIDENT':               { color: '#5FD0D8', badge: 'TRAFFIC' },
  'WELFARE CHECK':          { color: '#a78bfa', badge: 'WELFARE' },
  'MENTAL HEALTH':          { color: '#a78bfa', badge: 'WELFARE' },
  'THEFT':                  { color: 'rgba(180,220,255,0.5)', badge: 'PROPERTY' },
  'BURGLARY':               { color: 'rgba(180,220,255,0.5)', badge: 'PROPERTY' },
  'AUTO':                   { color: 'rgba(180,220,255,0.5)', badge: 'PROPERTY' },
}

function getPriority(type = '') {
  const up = type.toUpperCase()
  for (const [key, val] of Object.entries(PRIORITY_MAP)) {
    if (up.includes(key)) return val
  }
  return { color: 'rgba(180,220,255,0.3)', badge: 'OTHER' }
}

function timeAgo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'JUST NOW'
  if (mins < 60) return `${mins}m AGO`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h AGO`
  return `${Math.floor(hrs / 24)}d AGO`
}

const BADGE_FILTERS = ['ALL', 'PRIORITY', 'ACTIVE', 'TRAFFIC', 'WELFARE', 'PROPERTY']

export default function PoliceWidget() {
  const [incidents, setIncidents]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [filter, setFilter]         = useState('ALL')
  const [expanded, setExpanded]     = useState(null)
  const prevIdsRef                  = useRef(new Set())
  const { setGlobeFocusLocation }   = useEllieStore()

  const fetchDispatch = useCallback(async () => {
    try {
      const r = await worldApi.getDispatch(50)
      if (r.data?.error) { setError(r.data.error); return }
      const fresh = r.data?.incidents ?? []

      // Sound: play police alert if any new PRIORITY incidents appeared
      const prevIds = prevIdsRef.current
      const newPriority = fresh.filter(inc =>
        !prevIds.has(inc.id) && getPriority(inc.type).badge === 'PRIORITY'
      )
      if (newPriority.length > 0 && prevIds.size > 0) {
        soundEngine.policeAlert()
        fireGoveeScene('police_alert')   // 🚨 Red pulse on Govee lights
      } else if (fresh.length > 0 && prevIds.size > 0) {
        soundEngine.dataRefresh()
      }
      prevIdsRef.current = new Set(fresh.map(i => i.id))

      setIncidents(fresh)
      setLastUpdate(new Date())
      setError(null)
    } catch (e) {
      setError('Feed unavailable')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchDispatch() }, [])
  useEffect(() => {
    const id = setInterval(fetchDispatch, REFRESH_MS)
    return () => clearInterval(id)
  }, [fetchDispatch])

  const filtered = incidents.filter(inc => {
    if (filter === 'ALL') return true
    return getPriority(inc.type).badge === filter
  })

  // Count by badge
  const counts = {}
  incidents.forEach(inc => {
    const b = getPriority(inc.type).badge
    counts[b] = (counts[b] || 0) + 1
  })

  return (
    <div style={{
      background: '#060f1a',
      border: '1px solid rgba(95,208,216,0.2)',
      borderRadius: 4,
      overflow: 'hidden',
      width: '100%',
      boxSizing: 'border-box',
    }}>

      {/* ── Header ── */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid rgba(95,208,216,0.15)',
        background: 'rgba(95,208,216,0.02)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: orb, fontSize: 9, letterSpacing: 3, color: '#5FD0D8', fontWeight: 700 }}>
              DISPATCH FEED
            </span>
            <span style={{ fontFamily: mono, fontSize: 7, color: 'rgba(180,220,255,0.35)', letterSpacing: 1 }}>
              SEATTLE PD
            </span>
            {(counts['PRIORITY'] || 0) > 0 && (
              <span style={{
                fontFamily: mono, fontSize: 7, color: '#ff3b3b',
                background: 'rgba(255,59,59,0.1)', border: '1px solid rgba(255,59,59,0.4)',
                borderRadius: 2, padding: '1px 5px', letterSpacing: 1,
                animation: 'dispatch-blink 2s step-end infinite',
              }}>
                ● {counts['PRIORITY']} PRIORITY
                <style>{`@keyframes dispatch-blink{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
              </span>
            )}
          </div>
          <button onClick={fetchDispatch} style={{
            background: 'none', border: '1px solid rgba(95,208,216,0.18)',
            borderRadius: 2, color: 'rgba(95,208,216,0.5)',
            fontFamily: mono, fontSize: 9, padding: '2px 6px', cursor: 'pointer',
          }}>↻</button>
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: 4, marginTop: 7, flexWrap: 'wrap' }}>
          {BADGE_FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              background: filter === f ? 'rgba(95,208,216,0.1)' : 'none',
              border: `1px solid ${filter === f ? 'rgba(95,208,216,0.5)' : 'rgba(95,208,216,0.12)'}`,
              borderRadius: 2,
              color: filter === f ? '#5FD0D8' : 'rgba(180,220,255,0.35)',
              fontFamily: mono, fontSize: 7, letterSpacing: 1,
              padding: '2px 6px', cursor: 'pointer', transition: 'all 0.15s',
            }}>
              {f}{f !== 'ALL' && counts[f] ? ` (${counts[f]})` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* ── Feed ── */}
      <div style={{ maxHeight: 340, overflowY: 'auto' }}>
        {loading && (
          <div style={{ padding: 20, fontFamily: mono, fontSize: 9, color: 'rgba(180,220,255,0.3)', letterSpacing: 2, textAlign: 'center' }}>
            CONNECTING TO DISPATCH FEED...
          </div>
        )}
        {!loading && error && (
          <div style={{ padding: 16, fontFamily: mono, fontSize: 9, color: '#ffb300', letterSpacing: 1, textAlign: 'center' }}>
            ⚠ {error}
          </div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ padding: 16, fontFamily: mono, fontSize: 9, color: 'rgba(180,220,255,0.25)', letterSpacing: 2, textAlign: 'center' }}>
            NO {filter !== 'ALL' ? filter + ' ' : ''}INCIDENTS
          </div>
        )}
        {filtered.map((inc, i) => {
          const { color, badge } = getPriority(inc.type)
          const isOpen = expanded === inc.id
          return (
            <div
              key={inc.id || i}
              onClick={() => {
                const next = isOpen ? null : inc.id
                setExpanded(next)
                // Fly satellite to incident location if coords available
                if (!isOpen && inc.lat && inc.lng) {
                  setGlobeFocusLocation({
                    lat:  inc.lat,
                    lng:  inc.lng,
                    name: `${inc.type || 'INCIDENT'} — ${inc.neighborhood || inc.sector || 'SEATTLE'}`,
                    zoom: 15,
                  })
                }
              }}
              style={{
                borderBottom: '1px solid rgba(95,208,216,0.06)',
                borderLeft: `2px solid ${color}`,
                padding: '6px 12px 6px 10px',
                cursor: 'pointer',
                background: isOpen ? 'rgba(95,208,216,0.04)' : 'transparent',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = 'rgba(95,208,216,0.03)' }}
              onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'transparent' }}
            >
              {/* Row 1: badge + type + time */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontFamily: mono, fontSize: 6, letterSpacing: 1,
                  color, border: `1px solid ${color}40`,
                  background: `${color}14`,
                  padding: '1px 4px', borderRadius: 2, flexShrink: 0,
                }}>{badge}</span>
                <span style={{ fontFamily: raj, fontSize: 11, color: '#cceeff', flex: 1, lineHeight: 1.3 }}>
                  {inc.type || 'UNKNOWN CALL TYPE'}
                </span>
                <span style={{ fontFamily: mono, fontSize: 7, color: 'rgba(180,220,255,0.35)', flexShrink: 0 }}>
                  {timeAgo(inc.queued)}
                </span>
              </div>

              {/* Row 2: location meta */}
              <div style={{ display: 'flex', gap: 10, marginTop: 2, alignItems: 'center' }}>
                {inc.sector && (
                  <span style={{ fontFamily: mono, fontSize: 7, color: 'rgba(180,220,255,0.4)' }}>
                    SECTOR {inc.sector}{inc.beat ? `·${inc.beat}` : ''}
                  </span>
                )}
                {inc.neighborhood && (
                  <span style={{ fontFamily: mono, fontSize: 7, color: 'rgba(180,220,255,0.35)' }}>
                    {inc.neighborhood.toUpperCase()}
                  </span>
                )}
                {inc.lat && inc.lng && (
                  <span style={{ fontFamily: mono, fontSize: 7, color: 'rgba(95,208,216,0.45)', marginLeft: 'auto' }}
                    title="Click to fly satellite map to this location">
                    📍
                  </span>
                )}
              </div>

              {/* Expanded detail */}
              {isOpen && (
                <div style={{
                  marginTop: 6, paddingTop: 6,
                  borderTop: '1px solid rgba(95,208,216,0.1)',
                  display: 'flex', flexDirection: 'column', gap: 3,
                }}>
                  {[
                    ['GROUP',    inc.group],
                    ['AREA',     inc.neighborhood],
                    ['SECTOR',   inc.sector],
                    ['BEAT',     inc.beat],
                    ['PRIORITY', inc.priority],
                    ['QUEUED',   inc.queued ? new Date(inc.queued).toLocaleTimeString() : null],
                    ['ON SCENE', inc.at_scene ? new Date(inc.at_scene).toLocaleTimeString() : null],
                    ['EVENT #',  inc.id],
                  ].filter(([, v]) => v).map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', gap: 10 }}>
                      <span style={{ fontFamily: mono, fontSize: 7, color: 'rgba(180,220,255,0.35)', letterSpacing: 1, width: 62 }}>{k}</span>
                      <span style={{ fontFamily: mono, fontSize: 8, color: 'rgba(180,220,255,0.7)' }}>{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      {lastUpdate && (
        <div style={{
          padding: '3px 12px', borderTop: '1px solid rgba(95,208,216,0.06)',
          fontFamily: mono, fontSize: 7, color: 'rgba(180,220,255,0.2)', letterSpacing: 1,
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>SRC: SEATTLE OPEN DATA · SPD CAD</span>
          <span>SYNC {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      )}
    </div>
  )
}
