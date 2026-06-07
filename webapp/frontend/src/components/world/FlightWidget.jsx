import { useEffect, useRef, useState, useCallback } from 'react'
import { worldApi } from '../../lib/api'

const orb  = "'Orbitron', sans-serif"
const mono = "'Share Tech Mono', monospace"
const raj  = "'Rajdhani', sans-serif"

const REFRESH_MS = 60_000   // 60s — OpenSky free tier, 1 req/min
const MAP_H = 'clamp(220px, 30vh, 320px)'

// Altitude → color (meters)
function altColor(alt) {
  if (!alt || alt < 0)  return '#00ff9d'   // ground / unknown
  if (alt < 3000)       return '#ffb300'   // low approach
  if (alt < 8000)       return '#5FD0D8'   // mid
  return '#cceeff'                          // cruise
}

function mps2kts(mps) {
  return mps ? Math.round(mps * 1.944) : null
}

function m2ft(m) {
  return m ? Math.round(m * 3.281).toLocaleString() : null
}

// Draw a filled triangle rotated to heading
function planeIcon(heading, color) {
  const r = heading ?? 0
  const svg = `
    <svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'>
      <g transform='rotate(${r} 10 10)'>
        <polygon points='10,2 14,16 10,13 6,16' fill='${color}' stroke='rgba(0,0,0,0.6)' stroke-width='0.8'/>
      </g>
    </svg>`
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

export default function FlightWidget() {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)
  const markersRef   = useRef({})
  const [flights, setFlights]       = useState([])
  const [selected, setSelected]     = useState(null)
  const [loading, setLoading]       = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [mapReady, setMapReady]     = useState(false)
  const [view, setView]             = useState('map')   // 'map' | 'list'
  const [source, setSource]         = useState(null)

  // ── Fetch flights ────────────────────────────────────────────────────────
  const fetchFlights = useCallback(async () => {
    try {
      // Seattle center, 150nm radius — covers SEA, BFI, PAE, OLM, all Puget Sound traffic
      const r = await worldApi.getFlights({ lat: 47.6, lon: -122.3, dist: 150 })
      const data = r.data?.flights ?? []
      setFlights(data)
      setLastUpdate(new Date())
      setSource(r.data?.source || 'unknown')
      updateMapMarkers(data)
    } catch {
      // API may rate-limit — keep stale data
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Init Leaflet map ─────────────────────────────────────────────────────
  function initMap() {
    if (!window.L || !containerRef.current || mapRef.current) return
    const L = window.L

    const map = L.map(containerRef.current, {
      center: [47.6, -122.3],
      zoom: 7,
      zoomControl: false,
      attributionControl: false,
    })

    // Dark basemap
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 14 }
    ).addTo(map)

    mapRef.current = map
    // Force Leaflet to recalculate container size after layout settles
    setTimeout(() => map.invalidateSize(), 100)
    setMapReady(true)
  }

  useEffect(() => {
    // Leaflet CSS/JS already injected by SatelliteWidget, but be safe
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'; link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }
    if (window.L) {
      initMap()
    } else if (!document.getElementById('leaflet-js')) {
      const s = document.createElement('script')
      s.id = 'leaflet-js'
      s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      s.onload = initMap
      document.head.appendChild(s)
    } else {
      const poll = setInterval(() => { if (window.L) { clearInterval(poll); initMap() } }, 100)
      return () => clearInterval(poll)
    }
  }, [])

  useEffect(() => {
    if (mapReady) fetchFlights()
  }, [mapReady])

  useEffect(() => {
    const id = setInterval(fetchFlights, REFRESH_MS)
    return () => clearInterval(id)
  }, [fetchFlights])

  // ── Update markers on map ─────────────────────────────────────────────────
  function updateMapMarkers(data) {
    if (!mapRef.current || !window.L) return
    const L = window.L
    const map = mapRef.current
    const currentIcaos = new Set(data.map(f => f.icao))

    // Remove stale markers
    Object.keys(markersRef.current).forEach(icao => {
      if (!currentIcaos.has(icao)) {
        markersRef.current[icao].remove()
        delete markersRef.current[icao]
      }
    })

    // Add / update markers
    data.forEach(f => {
      const color = altColor(f.altitude)
      const icon  = L.icon({
        iconUrl: planeIcon(f.heading, color),
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      })

      if (markersRef.current[f.icao]) {
        markersRef.current[f.icao].setLatLng([f.lat, f.lng]).setIcon(icon)
      } else {
        const marker = L.marker([f.lat, f.lng], { icon })
          .addTo(map)
          .on('click', () => setSelected(f))
        markersRef.current[f.icao] = marker
      }
    })
  }

  // Click aircraft in list → zoom map
  function focusFlight(f) {
    setSelected(f)
    if (mapRef.current) {
      mapRef.current.flyTo([f.lat, f.lng], 10, { duration: 0.8 })
    }
  }

  const airborne = flights.filter(f => !f.on_ground)
  const grounded = flights.filter(f => f.on_ground)

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
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 12px',
        borderBottom: '1px solid rgba(95,208,216,0.15)',
        background: 'rgba(95,208,216,0.02)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: orb, fontSize: 9, letterSpacing: 3, color: '#5FD0D8', fontWeight: 700 }}>
            FLIGHT TRACKER
          </span>
          {!loading && (
            <span style={{ fontFamily: mono, fontSize: 8, color: 'rgba(180,220,255,0.4)' }}>
              {airborne.length} AIRBORNE · {grounded.length} GND
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {['map', 'list'].map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              background: view === v ? 'rgba(95,208,216,0.12)' : 'none',
              border: `1px solid ${view === v ? '#5FD0D8' : 'rgba(95,208,216,0.18)'}`,
              borderRadius: 2, color: view === v ? '#5FD0D8' : 'rgba(180,220,255,0.4)',
              fontFamily: mono, fontSize: 7, letterSpacing: 1,
              padding: '2px 7px', cursor: 'pointer',
            }}>{v.toUpperCase()}</button>
          ))}
          <button onClick={fetchFlights} title="Refresh" style={{
            background: 'none', border: '1px solid rgba(95,208,216,0.18)',
            borderRadius: 2, color: 'rgba(95,208,216,0.5)',
            fontFamily: mono, fontSize: 9, padding: '2px 6px', cursor: 'pointer',
          }}>↻</button>
        </div>
      </div>

      {/* ── Map view ── */}
      <div style={{ display: view === 'map' ? 'block' : 'none', position: 'relative' }}>
        <div ref={containerRef} style={{ width: '100%', height: MAP_H }} />

        {loading && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#060f1a', fontFamily: mono, fontSize: 9, color: 'rgba(180,220,255,0.4)', letterSpacing: 2,
          }}>
            ACQUIRING TRANSPONDER SIGNALS...
          </div>
        )}

        {/* Altitude legend */}
        {!loading && (
          <div style={{
            position: 'absolute', bottom: 6, left: 8, zIndex: 1000, pointerEvents: 'none',
            display: 'flex', flexDirection: 'column', gap: 2,
          }}>
            {[['#cceeff', 'CRUISE 26K+ FT'], ['#5FD0D8', 'MID 10-26K FT'], ['#ffb300', 'LOW <10K FT'], ['#00ff9d', 'GROUND']].map(([c, label]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(3,12,20,0.75)', padding: '1px 5px', borderRadius: 2 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />
                <span style={{ fontFamily: mono, fontSize: 6, color: 'rgba(180,220,255,0.6)', letterSpacing: 1 }}>{label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Selected aircraft HUD */}
        {selected && (
          <div style={{
            position: 'absolute', top: 6, left: 8, zIndex: 1000,
            background: 'rgba(3,12,20,0.92)', border: '1px solid rgba(95,208,216,0.4)',
            borderRadius: 3, padding: '6px 10px', minWidth: 140,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontFamily: orb, fontSize: 9, color: '#5FD0D8', letterSpacing: 1 }}>{selected.callsign}</span>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'rgba(180,220,255,0.4)', cursor: 'pointer', fontSize: 12, padding: 0 }}>×</button>
            </div>
            {[
              ['ALT', selected.altitude ? `${m2ft(selected.altitude)} ft` : 'GND'],
              ['SPD', selected.velocity ? `${mps2kts(selected.velocity)} kts` : '—'],
              ['HDG', selected.heading != null ? `${Math.round(selected.heading)}°` : '—'],
              ['CTY', selected.country || '—'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontFamily: mono, fontSize: 7, color: 'rgba(180,220,255,0.4)', letterSpacing: 1 }}>{k}</span>
                <span style={{ fontFamily: mono, fontSize: 8, color: '#cceeff' }}>{v}</span>
              </div>
            ))}
          </div>
        )}

        {/* Vignette */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 999, pointerEvents: 'none',
          background: 'linear-gradient(to bottom, rgba(95,208,216,0.02) 0%, transparent 8%, transparent 92%, rgba(95,208,216,0.02) 100%)',
        }} />
      </div>

      {/* ── List view ── */}
      {view === 'list' && (
        <div style={{ maxHeight: MAP_H, overflowY: 'auto' }}>
          {loading && (
            <div style={{ padding: 16, fontFamily: mono, fontSize: 9, color: 'rgba(180,220,255,0.3)', letterSpacing: 2, textAlign: 'center' }}>
              SCANNING...
            </div>
          )}
          {!loading && flights.length === 0 && (
            <div style={{ padding: 16, fontFamily: mono, fontSize: 9, color: 'rgba(180,220,255,0.3)', letterSpacing: 2, textAlign: 'center', lineHeight: 1.8 }}>
              NO AIRCRAFT DETECTED<br/>
              <span style={{ fontSize: 7, color: 'rgba(180,220,255,0.18)' }}>FEED MAY BE RATE-LIMITED · RETRY IN 60s</span>
            </div>
          )}
          {flights.slice(0, 30).map(f => (
            <div
              key={f.icao}
              onClick={() => focusFlight(f)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 12px',
                borderBottom: '1px solid rgba(95,208,216,0.06)',
                cursor: 'pointer',
                background: selected?.icao === f.icao ? 'rgba(95,208,216,0.07)' : 'transparent',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(95,208,216,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = selected?.icao === f.icao ? 'rgba(95,208,216,0.07)' : 'transparent'}
            >
              <div style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: altColor(f.altitude),
                boxShadow: `0 0 4px ${altColor(f.altitude)}`,
              }} />
              <span style={{ fontFamily: orb, fontSize: 8, color: '#5FD0D8', width: 72, letterSpacing: 1 }}>{f.callsign}</span>
              <span style={{ fontFamily: mono, fontSize: 8, color: 'rgba(180,220,255,0.5)', flex: 1 }}>{f.country}</span>
              <span style={{ fontFamily: mono, fontSize: 8, color: '#cceeff', width: 60, textAlign: 'right' }}>
                {f.on_ground ? 'GND' : f.altitude ? `${m2ft(f.altitude)} ft` : '—'}
              </span>
              <span style={{ fontFamily: mono, fontSize: 8, color: 'rgba(180,220,255,0.4)', width: 48, textAlign: 'right' }}>
                {f.velocity ? `${mps2kts(f.velocity)}kts` : '—'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Last update footer */}
      {lastUpdate && (
        <div style={{
          padding: '3px 12px',
          borderTop: '1px solid rgba(95,208,216,0.06)',
          fontFamily: mono, fontSize: 7, color: 'rgba(180,220,255,0.25)', letterSpacing: 1,
        }}>
          SRC: {source === 'adsb.lol' ? 'ADSB.LOL' : source === 'opensky' ? 'OPENSKY' : 'UNKNOWN'} · SYNC {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · AUTO-REFRESH 60s
        </div>
      )}
    </div>
  )
}
