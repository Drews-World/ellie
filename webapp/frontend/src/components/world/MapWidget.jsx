import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import Globe from 'react-globe.gl'
import { useEllieStore } from '../../store'
import { worldApi } from '../../lib/api'

const mono  = "'Share Tech Mono', monospace"
const orb   = "'Orbitron', sans-serif"
const raj   = "'Rajdhani', sans-serif"

// ── Conflict / threat zones ───────────────────────────────────────────────────
const ZONES = [
  { id: 'ukraine',      name: 'UKRAINE',          lat: 49.0,  lng: 32.0,  severity: 'critical',
    keywords: ['ukraine', 'kyiv', 'zelensky', 'zaporizhzhia', 'bakhmut', 'kharkiv'] },
  { id: 'israel',       name: 'ISRAEL / GAZA',    lat: 31.5,  lng: 35.0,  severity: 'critical',
    keywords: ['israel', 'gaza', 'hamas', 'idf', 'netanyahu', 'west bank', 'hezbollah', 'rafah'] },
  { id: 'sudan',        name: 'SUDAN',            lat: 15.5,  lng: 32.5,  severity: 'critical',
    keywords: ['sudan', 'rsf', 'khartoum', 'darfur', 'rapid support'] },
  { id: 'taiwan',       name: 'TAIWAN STRAIT',    lat: 23.7,  lng: 120.9, severity: 'elevated',
    keywords: ['taiwan', 'strait', 'tsai', 'pla navy', 'taipei'] },
  { id: 'north-korea',  name: 'NORTH KOREA',      lat: 40.3,  lng: 127.5, severity: 'elevated',
    keywords: ['north korea', 'kim jong', 'dprk', 'pyongyang', 'missile'] },
  { id: 'iran',         name: 'IRAN',             lat: 32.4,  lng: 53.6,  severity: 'elevated',
    keywords: ['iran', 'iranian', 'tehran', 'irgc', 'nuclear', 'sanctions'] },
  { id: 'south-china',  name: 'SOUTH CHINA SEA',  lat: 12.5,  lng: 114.0, severity: 'elevated',
    keywords: ['south china sea', 'spratly', 'paracels', 'philippines sea', 'scarborough'] },
  { id: 'sahel',        name: 'SAHEL / W. AFRICA', lat: 14.5,  lng:  1.5,  severity: 'elevated',
    keywords: ['mali', 'niger', 'burkina faso', 'sahel', 'wagner group', 'boko haram'] },
  { id: 'myanmar',      name: 'MYANMAR',          lat: 19.7,  lng: 96.1,  severity: 'elevated',
    keywords: ['myanmar', 'burma', 'junta', 'rohingya', 'tatmadaw'] },
  { id: 'pakistan',     name: 'PAKISTAN',         lat: 30.4,  lng: 69.3,  severity: 'moderate',
    keywords: ['pakistan', 'islamabad', 'isi', 'imran khan', 'balochistan'] },
  { id: 'ethiopia',     name: 'HORN OF AFRICA',   lat:  9.1,  lng: 40.5,  severity: 'moderate',
    keywords: ['ethiopia', 'somalia', 'tigray', 'al-shabaab', 'kenya'] },
  { id: 'haiti',        name: 'HAITI',            lat: 18.9,  lng: -72.3, severity: 'moderate',
    keywords: ['haiti', 'gang', 'port-au-prince', 'ariel henry'] },
  { id: 'venezuela',    name: 'VENEZUELA',        lat:  8.0,  lng: -66.6, severity: 'moderate',
    keywords: ['venezuela', 'maduro', 'caracas', 'guaido'] },
  { id: 'cyber',        name: 'CYBERSPACE',       lat: 51.5,  lng: 10.5,  severity: 'elevated',
    keywords: ['cyberattack', 'ransomware', 'hack', 'data breach', 'espionage', 'cyber'] },
]

const SEVERITY_COLOR = {
  critical: '#ff3b3b',
  elevated: '#ffb300',
  moderate: '#5FD0D8',
  low:      '#00ff9d',
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function RingPulse({ color }) {
  return (
    <div style={{
      width: 10, height: 10, borderRadius: '50%',
      background: color,
      boxShadow: `0 0 8px ${color}, 0 0 2px ${color}`,
      flexShrink: 0,
      animation: 'ring-pulse 2s ease-in-out infinite',
    }}>
      <style>{`@keyframes ring-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.3)}}`}</style>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function GlobeWidget() {
  const globeRef      = useRef()
  const containerRef  = useRef()
  const { setGlobeFocusLocation } = useEllieStore()
  const [dims, setDims]             = useState({ w: 400, h: 260 })
  const [selectedZone, setSelected] = useState(null)
  const [hoverId, setHoverId]       = useState(null)
  // zone_id → { loading, articles, assessment, threat_level, key_developments, error }
  const [intelCache, setIntelCache] = useState({})

  // Track BOTH width and height from the container
  useEffect(() => {
    if (!containerRef.current) return
    const update = (el) => {
      const w = el.clientWidth  || 400
      const h = Math.min(Math.round(w * 0.65), 320)   // ~65% aspect ratio, max 320px
      setDims({ w, h })
    }
    const ro = new ResizeObserver(([e]) => update(e.target))
    ro.observe(containerRef.current)
    update(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Auto-rotate + initial camera
  useEffect(() => {
    const g = globeRef.current
    if (!g) return
    const ctrl = g.controls()
    ctrl.autoRotate      = true
    ctrl.autoRotateSpeed = 0.55
    ctrl.enableZoom      = true
    ctrl.minDistance     = 150
    ctrl.maxDistance     = 500
    g.pointOfView({ altitude: 2.2 })
  }, [dims]) // re-fire when dims resolve

  // Pause rotation while zone panel is open
  useEffect(() => {
    const g = globeRef.current
    if (!g) return
    g.controls().autoRotate = !selectedZone
  }, [selectedZone])

  const zones = ZONES   // static — severity is a fallback until intel loads

  const fetchIntel = useCallback(async (zone) => {
    if (intelCache[zone.id]?.articles || intelCache[zone.id]?.loading) return
    setIntelCache(prev => ({ ...prev, [zone.id]: { loading: true } }))
    try {
      const r = await worldApi.getZoneIntel(zone)
      setIntelCache(prev => ({ ...prev, [zone.id]: { loading: false, ...r.data } }))
    } catch {
      setIntelCache(prev => ({ ...prev, [zone.id]: { loading: false, error: 'Intel feed unavailable' } }))
    }
  }, [intelCache])

  const handlePointClick = useCallback((zone) => {
    const isDeselect = selectedZone?.id === zone.id
    setSelected(isDeselect ? null : zone)
    if (!isDeselect) {
      fetchIntel(zone)
      const zoomMap = { critical: 6, elevated: 5, moderate: 4, low: 3 }
      setGlobeFocusLocation({ lat: zone.lat, lng: zone.lng, name: zone.name, zoom: zoomMap[zone.severity] ?? 5 })
    }
  }, [selectedZone, fetchIntel, setGlobeFocusLocation])

  const pointColor  = useCallback(d => SEVERITY_COLOR[d.severity], [])
  const pointRadius = useCallback(d => d.id === hoverId ? 2.2 : 1.5, [hoverId])
  const pointLabel  = useCallback(d =>
    `<div style="font-family:'Orbitron',sans-serif;font-size:10px;color:#5FD0D8;padding:4px 8px;background:rgba(6,15,26,0.92);border:1px solid rgba(95,208,216,0.45);border-radius:2px;white-space:nowrap">${d.name}</div>`,
  [])

  return (
    <div style={{
      background: '#060f1a',
      border: '1px solid rgba(95,208,216,0.2)',
      borderRadius: 4,
      overflow: 'hidden',
      position: 'relative',
      width: '100%',
      boxSizing: 'border-box',
    }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 12px',
        borderBottom: '1px solid rgba(95,208,216,0.15)',
        background: 'rgba(95,208,216,0.02)',
      }}>
        <div style={{ fontFamily: orb, fontSize: 9, letterSpacing: 3, color: '#5FD0D8', fontWeight: 700 }}>
          GLOBAL THREAT MAP
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {Object.entries(SEVERITY_COLOR).map(([lvl, col]) => (
            <div key={lvl} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: col, boxShadow: `0 0 4px ${col}` }} />
              <span style={{ fontFamily: mono, fontSize: 7, color: 'rgba(180,220,255,0.5)' }}>{lvl.toUpperCase()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Globe ── */}
      <div ref={containerRef} style={{ width: '100%', height: dims.h, position: 'relative' }}>
        {dims.w > 0 && (
          <Globe
            ref={globeRef}
            width={dims.w}
            height={dims.h}
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
            bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
            backgroundColor="rgba(3,12,20,1)"
            atmosphereColor="#5FD0D8"
            atmosphereAltitude={0.1}
            pointsData={zones}
            pointLat="lat"
            pointLng="lng"
            pointColor={pointColor}
            pointRadius={pointRadius}
            pointAltitude={0.06}
            pointResolution={12}
            pointLabel={pointLabel}
            onPointClick={handlePointClick}
            onPointHover={d => setHoverId(d?.id ?? null)}
          />
        )}
      </div>

      {/* ── Zone Intel Panel ── */}
      {selectedZone && (() => {
        const intel = intelCache[selectedZone.id] || {}
        const activeSeverity = intel.threat_level || selectedZone.severity
        const accentColor    = SEVERITY_COLOR[activeSeverity] || SEVERITY_COLOR[selectedZone.severity]

        return (
          <div style={{
            borderTop: `2px solid ${accentColor}`,
            background: 'rgba(3,12,20,0.98)',
            maxHeight: 320,
            overflowY: 'auto',
          }}>
            {/* Header row */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              padding: '10px 14px 8px',
              borderBottom: '1px solid rgba(95,208,216,0.1)',
              position: 'sticky', top: 0, background: 'rgba(3,12,20,0.98)', zIndex: 1,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <RingPulse color={accentColor} />
                <div>
                  <div style={{ fontFamily: orb, fontSize: 11, letterSpacing: 2, color: accentColor }}>
                    {selectedZone.name}
                  </div>
                  <div style={{ fontFamily: mono, fontSize: 8, color: 'rgba(180,220,255,0.45)', marginTop: 2, display: 'flex', gap: 8 }}>
                    <span style={{ color: accentColor }}>{activeSeverity.toUpperCase()}</span>
                    {intel.article_count > 0 && <span>{intel.article_count} SOURCES</span>}
                    {intel.loading && <span style={{ color: '#5FD0D8' }}>ACQUIRING...</span>}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{ background: 'none', border: 'none', color: 'rgba(180,220,255,0.5)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
              >×</button>
            </div>

            <div style={{ padding: '10px 14px' }}>
              {/* Loading skeleton */}
              {intel.loading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[80, 60, 90, 55].map((w, i) => (
                    <div key={i} style={{
                      height: 8, width: `${w}%`, borderRadius: 2,
                      background: 'rgba(95,208,216,0.12)',
                      animation: 'intel-shimmer 1.4s ease-in-out infinite',
                      animationDelay: `${i * 0.1}s`,
                    }} />
                  ))}
                  <style>{`@keyframes intel-shimmer { 0%,100%{opacity:.4} 50%{opacity:.9} }`}</style>
                </div>
              )}

              {/* Error state */}
              {intel.error && !intel.loading && (
                <div style={{ fontFamily: mono, fontSize: 9, color: 'rgba(255,59,59,0.7)', padding: '4px 0' }}>
                  {intel.error}
                </div>
              )}

              {/* ELLIE Assessment */}
              {intel.assessment && (
                <div style={{
                  marginBottom: 10, padding: '8px 10px',
                  background: `rgba(${accentColor === SEVERITY_COLOR.critical ? '255,59,59' : accentColor === SEVERITY_COLOR.elevated ? '255,179,0' : '95,208,216'},0.07)`,
                  border: `1px solid ${accentColor}30`,
                  borderRadius: 3,
                }}>
                  <div style={{ fontFamily: mono, fontSize: 7, letterSpacing: 2, color: accentColor, marginBottom: 5 }}>
                    ▸ ELLIE ASSESSMENT
                  </div>
                  <div style={{ fontFamily: raj, fontSize: 11, color: '#cceeff', lineHeight: 1.55 }}>
                    {intel.assessment}
                  </div>
                </div>
              )}

              {/* Key developments */}
              {intel.key_developments?.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontFamily: mono, fontSize: 7, letterSpacing: 2, color: 'rgba(180,220,255,0.5)', marginBottom: 5 }}>
                    KEY DEVELOPMENTS
                  </div>
                  {intel.key_developments.map((d, i) => (
                    <div key={i} style={{
                      fontFamily: raj, fontSize: 10, color: 'rgba(180,220,255,0.75)',
                      lineHeight: 1.4, padding: '2px 0 2px 10px',
                      borderLeft: `2px solid ${accentColor}60`,
                      marginBottom: 3,
                    }}>
                      {d}
                    </div>
                  ))}
                </div>
              )}

              {/* News articles */}
              {intel.articles?.length > 0 && (
                <div>
                  <div style={{ fontFamily: mono, fontSize: 7, letterSpacing: 2, color: 'rgba(180,220,255,0.5)', marginBottom: 6 }}>
                    INTELLIGENCE FEED — {intel.articles.length} ARTICLES
                  </div>
                  {intel.articles.map((a, i) => (
                    <a
                      key={i}
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: 'block', textDecoration: 'none' }}
                      onClick={e => e.stopPropagation()}
                    >
                      <div
                        style={{ padding: '7px 0', borderBottom: '1px solid rgba(95,208,216,0.07)', transition: 'background 0.15s', cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(95,208,216,0.05)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ fontFamily: raj, fontSize: 11, color: '#cceeff', lineHeight: 1.45, marginBottom: 3 }}>
                          {a.title}
                        </div>
                        <div style={{ fontFamily: mono, fontSize: 8, color: 'rgba(180,220,255,0.35)', display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span>{a.source?.name?.toUpperCase()}</span>
                          <span>{timeAgo(a.publishedAt)}</span>
                          <span style={{ marginLeft: 'auto', color: `${accentColor}80` }}>↗</span>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}

              {/* Empty — shouldn't normally show since we always have GDELT */}
              {!intel.loading && !intel.error && !intel.articles?.length && (
                <div style={{ fontFamily: mono, fontSize: 9, color: 'rgba(180,220,255,0.3)', padding: '4px 0' }}>
                  NO ARTICLES FOUND — TRY AGAIN SHORTLY
                </div>
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
