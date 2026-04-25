/**
 * WarRoomMode — Full-screen event fusion overlay
 * Fixed: globe renders immediately using window dimensions, no ResizeObserver delay
 */
import { useRef, useEffect, useState, useMemo } from 'react'
import Globe from 'react-globe.gl'
import { useEllieStore } from '../../store'
import { worldApi } from '../../lib/api'

const mono = "'Share Tech Mono', monospace"
const orb  = "'Orbitron', sans-serif"
const raj  = "'Rajdhani', sans-serif"

const PANEL_W  = 300   // right event panel width px
const TOP_H    = 48    // top bar height px
const BOTTOM_H = 30    // bottom bar height px

const ZONES = [
  { id: 'ukraine',     name: 'UKRAINE',          lat: 49.0, lng:  32.0, severity: 'critical' },
  { id: 'israel',      name: 'ISRAEL / GAZA',    lat: 31.5, lng:  35.0, severity: 'critical' },
  { id: 'sudan',       name: 'SUDAN',            lat: 15.5, lng:  32.5, severity: 'critical' },
  { id: 'taiwan',      name: 'TAIWAN STRAIT',    lat: 23.7, lng: 120.9, severity: 'elevated' },
  { id: 'north-korea', name: 'NORTH KOREA',      lat: 40.3, lng: 127.5, severity: 'elevated' },
  { id: 'iran',        name: 'IRAN',             lat: 32.4, lng:  53.6, severity: 'elevated' },
  { id: 'south-china', name: 'SOUTH CHINA SEA',  lat: 12.5, lng: 114.0, severity: 'elevated' },
  { id: 'sahel',       name: 'SAHEL',            lat: 14.5, lng:   1.5, severity: 'elevated' },
  { id: 'myanmar',     name: 'MYANMAR',          lat: 19.7, lng:  96.1, severity: 'elevated' },
  { id: 'pakistan',    name: 'PAKISTAN',         lat: 30.4, lng:  69.3, severity: 'moderate' },
  { id: 'haiti',       name: 'HAITI',            lat: 18.9, lng: -72.3, severity: 'moderate' },
]

const SEV = {
  critical: { color: '#ff3b3b', bg: 'rgba(255,59,59,0.12)', border: 'rgba(255,59,59,0.3)', label: 'CRITICAL' },
  elevated: { color: '#ffb300', bg: 'rgba(255,179,0,0.1)',  border: 'rgba(255,179,0,0.25)', label: 'ELEVATED' },
  moderate: { color: '#00d4ff', bg: 'rgba(0,212,255,0.08)', border: 'rgba(0,212,255,0.2)',  label: 'MODERATE' },
}

function timeAgo(iso) {
  if (!iso) return ''
  const mins = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (mins < 1)  return 'NOW'
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h`
}

function useWindowSize() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const handle = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', handle)
    return () => window.removeEventListener('resize', handle)
  }, [])
  return size
}

export default function WarRoomMode({ onClose }) {
  const globeRef   = useRef(null)
  const [flights,  setFlights]  = useState([])
  const [dispatch, setDispatch] = useState([])
  const [eventTab, setEventTab] = useState('ALL')
  const [globeReady, setGlobeReady] = useState(false)

  const news = useEllieStore(s => s.news)
  const { w, h } = useWindowSize()

  const globeW = w - PANEL_W
  const globeH = h - TOP_H - BOTTOM_H

  // ESC to close
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  // Fetch dispatch on open
  useEffect(() => {
    worldApi.getDispatch(25).then(r => setDispatch(r.data?.incidents ?? [])).catch(() => {})
  }, [])

  // Fetch flights on open
  useEffect(() => {
    const fetch = () => worldApi.getFlights({ lat: 47.6, lon: -122.3, dist: 150 })
      .then(r => setFlights(r.data?.flights ?? [])).catch(() => {})
    fetch()
    const id = setInterval(fetch, 60000)
    return () => clearInterval(id)
  }, [])

  // ── Globe data ───────────────────────────────────────────────────────────────
  const zonePoints = useMemo(() => ZONES.map(z => ({
    lat: z.lat, lng: z.lng,
    size:  z.severity === 'critical' ? 0.6 : z.severity === 'elevated' ? 0.45 : 0.3,
    color: SEV[z.severity]?.color ?? '#00d4ff',
    label: z.name,
  })), [])

  const flightPoints = useMemo(() =>
    flights.filter(f => !f.on_ground && f.lat && f.lng).map(f => ({
      lat: f.lat, lng: f.lng, size: 0.15, color: '#00ff9d', label: f.callsign || f.icao,
    }))
  , [flights])

  const allPoints = useMemo(() => [...zonePoints, ...flightPoints], [zonePoints, flightPoints])

  const arcs = useMemo(() => {
    const crit = ZONES.filter(z => z.severity === 'critical')
    const elev = ZONES.filter(z => z.severity === 'elevated')
    const out  = []
    crit.forEach(c => {
      [...elev].sort((a, b) =>
        Math.hypot(a.lat-c.lat, a.lng-c.lng) - Math.hypot(b.lat-c.lat, b.lng-c.lng)
      ).slice(0, 2).forEach(e => out.push({
        startLat: c.lat, startLng: c.lng,
        endLat: e.lat, endLng: e.lng,
        color: ['rgba(255,59,59,0.5)', 'rgba(255,179,0,0.3)'],
      }))
    })
    return out
  }, [])

  const rings = useMemo(() =>
    dispatch.filter(d => d.lat && d.lng).slice(0, 15).map(d => ({
      lat: d.lat, lng: d.lng,
      maxR: 1.2, propagationSpeed: 2.5, repeatPeriod: 900,
      color: (d.type||'').toUpperCase().match(/WEAPON|SHOT|HOMICIDE/)
        ? 'rgba(255,59,59,0.7)' : 'rgba(255,179,0,0.55)',
    }))
  , [dispatch])

  // ── Event feed ───────────────────────────────────────────────────────────────
  const events = useMemo(() => {
    const ev = []

    // Threats — always populated (hardcoded zones)
    ZONES.forEach(z => ev.push({
      type: 'THREAT', severity: z.severity,
      title: z.name, meta: SEV[z.severity]?.label || '',
      time: null, url: null,
    }))

    // Police priority incidents
    dispatch.filter(d => (d.type||'').toUpperCase().match(/WEAPON|ASSAULT|ROBBERY|SHOT|HOMICIDE/))
      .slice(0, 10).forEach(d => ev.push({
        type: 'POLICE', severity: 'critical',
        title: d.type, meta: d.neighborhood || d.sector || 'SEATTLE',
        time: d.queued, url: null,
      }))

    // News
    ;(news || []).slice(0, 8).forEach(n => ev.push({
      type: 'NEWS', severity: 'moderate',
      title: n.title || n.headline || '',
      meta: (typeof n.source === 'string' ? n.source : n.source?.name || '') || '',
      time: n.publishedAt || n.published,
      url: n.url,
    }))

    const order = { critical: 0, elevated: 1, moderate: 2, low: 3 }
    return ev.sort((a, b) => (order[a.severity]??2) - (order[b.severity]??2))
  }, [dispatch, news])

  const filtered = eventTab === 'ALL' ? events : events.filter(e => e.type === eventTab)
  const critCount = events.filter(e => e.severity === 'critical').length
  const elevCount = events.filter(e => e.severity === 'elevated').length

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: '#010810',
      display: 'flex', flexDirection: 'column',
    }}>

      {/* ── Top bar ── */}
      <div style={{
        height: TOP_H, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px',
        borderBottom: '1px solid rgba(255,59,59,0.3)',
        background: 'rgba(255,20,20,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 9, height: 9, borderRadius: '50%', background: '#ff3b3b',
            boxShadow: '0 0 8px #ff3b3b',
            animation: 'wr-blink 1.2s step-end infinite',
          }}/>
          <style>{`@keyframes wr-blink{0%,100%{opacity:1}50%{opacity:.15}}`}</style>
          <span style={{ fontFamily: orb, fontSize: 12, letterSpacing: 4, color: '#ff3b3b', fontWeight: 700 }}>
            WAR ROOM
          </span>
          <span style={{ fontFamily: mono, fontSize: 8, color: 'rgba(255,100,100,0.45)', letterSpacing: 1 }}>
            REAL-TIME EVENT FUSION
          </span>
          {critCount > 0 && (
            <span style={{
              fontFamily: mono, fontSize: 8, letterSpacing: 1,
              color: '#ff3b3b', background: 'rgba(255,59,59,0.15)',
              border: '1px solid rgba(255,59,59,0.35)',
              borderRadius: 2, padding: '2px 7px',
            }}>{critCount} CRITICAL</span>
          )}
          {elevCount > 0 && (
            <span style={{
              fontFamily: mono, fontSize: 8, letterSpacing: 1,
              color: '#ffb300', background: 'rgba(255,179,0,0.1)',
              border: '1px solid rgba(255,179,0,0.3)',
              borderRadius: 2, padding: '2px 7px',
            }}>{elevCount} ELEVATED</span>
          )}
          <span style={{ fontFamily: mono, fontSize: 7, color: 'rgba(0,255,157,0.6)' }}>
            ● {flights.filter(f=>!f.on_ground).length} AIRBORNE
          </span>
          <span style={{ fontFamily: mono, fontSize: 7, color: 'rgba(255,179,0,0.6)' }}>
            ● {dispatch.length} DISPATCH
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontFamily: mono, fontSize: 7, color: 'rgba(180,220,255,0.3)', letterSpacing: 1 }}>
            ESC TO EXIT
          </span>
          <button onClick={onClose} style={{
            background: 'rgba(255,59,59,0.12)',
            border: '1px solid rgba(255,59,59,0.45)',
            borderRadius: 3, color: '#ff3b3b',
            fontFamily: orb, fontSize: 8, letterSpacing: 2,
            padding: '5px 14px', cursor: 'pointer',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,59,59,0.25)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,59,59,0.12)'}
          >EXIT ✕</button>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Globe area */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative', background: '#010810' }}>
          <Globe
            ref={globeRef}
            width={globeW}
            height={globeH}
            backgroundColor="rgba(0,0,0,0)"
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
            bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
            atmosphereColor="rgba(255,40,40,0.2)"
            atmosphereAltitude={0.25}

            pointsData={allPoints}
            pointLat="lat"
            pointLng="lng"
            pointAltitude={0.01}
            pointRadius="size"
            pointColor="color"
            pointLabel="label"

            arcsData={arcs}
            arcStartLat="startLat"
            arcStartLng="startLng"
            arcEndLat="endLat"
            arcEndLng="endLng"
            arcColor="color"
            arcAltitudeAutoScale={0.35}
            arcStroke={0.6}
            arcDashLength={0.45}
            arcDashGap={0.25}
            arcDashAnimateTime={2500}

            ringsData={rings}
            ringLat="lat"
            ringLng="lng"
            ringMaxRadius="maxR"
            ringPropagationSpeed="propagationSpeed"
            ringRepeatPeriod="repeatPeriod"
            ringColor="color"
            ringAltitude={0.005}

            onGlobeReady={() => {
              setGlobeReady(true)
              if (globeRef.current) {
                globeRef.current.pointOfView({ lat: 25, lng: 25, altitude: 2.2 }, 800)
                globeRef.current.controls().autoRotate = true
                globeRef.current.controls().autoRotateSpeed = 0.25
                globeRef.current.controls().enableZoom = true
              }
            }}
          />

          {/* Loading overlay while globe initialises */}
          {!globeReady && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 10,
              background: '#010810',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 12,
            }}>
              <div style={{ fontFamily: orb, fontSize: 10, letterSpacing: 4, color: '#ff3b3b' }}>
                INITIALIZING WAR ROOM
              </div>
              <div style={{ fontFamily: mono, fontSize: 8, color: 'rgba(255,100,100,0.4)', letterSpacing: 2 }}>
                LOADING THREAT MATRIX...
              </div>
            </div>
          )}

          {/* Zone labels pinned top-left */}
          {globeReady && (
            <div style={{
              position: 'absolute', top: 14, left: 14, zIndex: 10,
              display: 'flex', flexDirection: 'column', gap: 4,
              pointerEvents: 'none',
            }}>
              {ZONES.filter(z => z.severity === 'critical').map(z => (
                <div key={z.id} style={{
                  fontFamily: mono, fontSize: 7, letterSpacing: 1,
                  color: SEV.critical.color,
                  background: SEV.critical.bg,
                  border: `1px solid ${SEV.critical.border}`,
                  borderRadius: 2, padding: '2px 7px',
                }}>● {z.name}</div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right panel ── */}
        <div style={{
          width: PANEL_W, flexShrink: 0,
          borderLeft: '1px solid rgba(255,59,59,0.2)',
          background: 'rgba(3,6,14,0.98)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>

          {/* Filter tabs */}
          <div style={{
            display: 'flex', borderBottom: '1px solid rgba(255,59,59,0.15)', flexShrink: 0,
          }}>
            {['ALL','THREAT','POLICE','NEWS'].map(tab => (
              <button key={tab} onClick={() => setEventTab(tab)} style={{
                flex: 1, padding: '9px 0',
                background: eventTab === tab ? 'rgba(255,59,59,0.1)' : 'none',
                border: 'none',
                borderBottom: `2px solid ${eventTab === tab ? '#ff3b3b' : 'transparent'}`,
                color: eventTab === tab ? '#ff3b3b' : 'rgba(180,220,255,0.3)',
                fontFamily: mono, fontSize: 7, letterSpacing: 1, cursor: 'pointer',
              }}>{tab}</button>
            ))}
          </div>

          {/* Feed */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filtered.length === 0 && (
              <div style={{
                padding: '20px 12px', fontFamily: mono, fontSize: 8,
                color: 'rgba(180,220,255,0.25)', letterSpacing: 1, textAlign: 'center',
              }}>NO EVENTS IN FEED</div>
            )}
            {filtered.map((ev, i) => {
              const s = SEV[ev.severity] || SEV.moderate
              return (
                <div key={i}
                  onClick={() => ev.url && window.open(ev.url, '_blank')}
                  style={{
                    borderBottom: '1px solid rgba(255,59,59,0.07)',
                    borderLeft: `3px solid ${s.color}`,
                    padding: '7px 10px 7px 9px',
                    cursor: ev.url ? 'pointer' : 'default',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (ev.url) e.currentTarget.style.background = 'rgba(255,59,59,0.05)' }}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 2 }}>
                    <span style={{
                      fontFamily: mono, fontSize: 6, letterSpacing: 1,
                      color: s.color, background: s.bg, border: `1px solid ${s.border}`,
                      borderRadius: 2, padding: '1px 4px', flexShrink: 0, marginTop: 1,
                    }}>{ev.type}</span>
                    <span style={{
                      fontFamily: raj, fontSize: 11, color: '#cceeff', flex: 1, lineHeight: 1.35,
                    }}>
                      {ev.title.length > 60 ? ev.title.slice(0,60)+'…' : ev.title}
                    </span>
                    {ev.time && (
                      <span style={{ fontFamily: mono, fontSize: 6, color: 'rgba(180,220,255,0.3)', flexShrink: 0 }}>
                        {timeAgo(ev.time)}
                      </span>
                    )}
                  </div>
                  {ev.meta && (
                    <div style={{ fontFamily: mono, fontSize: 7, color: 'rgba(180,220,255,0.38)', letterSpacing: 1 }}>
                      {String(ev.meta).toUpperCase()}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Counters footer */}
          <div style={{
            borderTop: '1px solid rgba(255,59,59,0.12)',
            display: 'flex', padding: '6px 0', flexShrink: 0,
          }}>
            {[
              ['THREAT ZONES', ZONES.length, '#ff3b3b'],
              ['AIRBORNE',     flights.filter(f=>!f.on_ground).length, '#00ff9d'],
              ['DISPATCH',     dispatch.length, '#ffb300'],
            ].map(([lbl, val, col]) => (
              <div key={lbl} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontFamily: orb, fontSize: 13, color: col, fontWeight: 700 }}>{val}</span>
                <span style={{ fontFamily: mono, fontSize: 6, color: 'rgba(180,220,255,0.3)', letterSpacing: 1 }}>{lbl}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom zone bar ── */}
      <div style={{
        height: BOTTOM_H, flexShrink: 0,
        borderTop: '1px solid rgba(255,59,59,0.12)',
        background: 'rgba(255,20,20,0.03)',
        display: 'flex', alignItems: 'center',
        padding: '0 16px', gap: 18, overflow: 'hidden',
      }}>
        {ZONES.map(z => {
          const c = SEV[z.severity]?.color || '#00d4ff'
          return (
            <div key={z.id} style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: c, boxShadow: `0 0 4px ${c}` }}/>
              <span style={{ fontFamily: mono, fontSize: 6, color: c, letterSpacing: 1 }}>{z.name}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
