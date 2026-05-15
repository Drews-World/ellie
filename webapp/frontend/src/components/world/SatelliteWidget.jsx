import { useEffect, useRef, useState } from 'react'
import { useEllieStore } from '../../store'

const orb  = "'Orbitron', sans-serif"
const mono = "'Share Tech Mono', monospace"

// Base imagery layers (no API key needed)
const LAYERS = [
  {
    id: 'esri-sat',
    label: 'SAT',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Esri, Maxar, Earthstar Geographics',
  },
  {
    id: 'esri-night',
    label: 'NIGHT',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Esri',
  },
  {
    id: 'osm',
    label: 'TERRAIN',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
  },
]

// Labels overlay — Esri World Boundaries and Places (countries, states, cities, bodies of water)
// This layer is transparent — only draws text/borders, no background. Safe to stack on any base.
const LABELS_OVERLAY_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'

// Hotspot locations for quick-jump
const HOTSPOTS = [
  { name: 'UKRAINE',      lat: 49.0,   lng: 32.0,  zoom: 5 },
  { name: 'MIDDLE EAST',  lat: 31.5,   lng: 35.0,  zoom: 5 },
  { name: 'TAIWAN',       lat: 23.7,   lng: 120.9, zoom: 5 },
  { name: 'S. CHINA SEA', lat: 12.5,   lng: 114.0, zoom: 4 },
  { name: 'SAHEL',        lat: 14.5,   lng:  1.5,  zoom: 4 },
  { name: 'SEATTLE',      lat: 47.6,   lng: -122.3, zoom: 9 },
  { name: 'GLOBAL',       lat: 20.0,   lng: 0.0,   zoom: 2 },
]

export default function SatelliteWidget() {
  const containerRef  = useRef(null)
  const mapRef        = useRef(null)
  const baseLayerRef  = useRef(null)
  const labelLayerRef = useRef(null)
  const [ready, setReady]             = useState(false)
  const [activeLayer, setActiveLayer] = useState('esri-sat')
  const [labelsOn, setLabelsOn]       = useState(true)
  const [coords, setCoords]           = useState(null)
  const [zoomLevel, setZoomLevel]     = useState(2)
  const [incomingZone, setIncomingZone] = useState(null)

  const globeFocusLocation = useEllieStore(s => s.globeFocusLocation)

  // Fly to location when globe zone is clicked
  useEffect(() => {
    if (!globeFocusLocation || !mapRef.current) return
    const { lat, lng, zoom, name } = globeFocusLocation
    mapRef.current.flyTo([lat, lng], zoom, { duration: 1.5 })
    setIncomingZone(name)
    const t = setTimeout(() => setIncomingZone(null), 3500)
    return () => clearTimeout(t)
  }, [globeFocusLocation])

  // Load Leaflet from CDN once
  useEffect(() => {
    function initMap() {
      if (!window.L || !containerRef.current || mapRef.current) return
      const L = window.L

      const map = L.map(containerRef.current, {
        center: [20, 0],
        zoom: 2,
        zoomControl: false,
        attributionControl: false,
      })

      // Base imagery
      baseLayerRef.current = L.tileLayer(LAYERS[0].url, { maxZoom: 18 }).addTo(map)

      // Labels overlay on top
      labelLayerRef.current = L.tileLayer(LABELS_OVERLAY_URL, {
        maxZoom: 18,
        opacity: 1,
        pane: 'overlayPane',
      }).addTo(map)

      map.on('mousemove', e => {
        setCoords({ lat: e.latlng.lat.toFixed(4), lng: e.latlng.lng.toFixed(4) })
      })
      map.on('zoomend', () => setZoomLevel(map.getZoom()))

      mapRef.current = map
      setReady(true)
    }

    // Inject Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id   = 'leaflet-css'
      link.rel  = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    if (window.L) {
      initMap()
    } else if (!document.getElementById('leaflet-js')) {
      const script  = document.createElement('script')
      script.id     = 'leaflet-js'
      script.src    = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      script.onload = initMap
      document.head.appendChild(script)
    } else {
      const poll = setInterval(() => { if (window.L) { clearInterval(poll); initMap() } }, 100)
      return () => clearInterval(poll)
    }
  }, [])

  // Swap base layer when activeLayer changes
  useEffect(() => {
    if (!mapRef.current || !window.L) return
    const layer = LAYERS.find(l => l.id === activeLayer)
    if (!layer) return
    if (baseLayerRef.current) baseLayerRef.current.remove()
    baseLayerRef.current = window.L.tileLayer(layer.url, { maxZoom: 18 }).addTo(mapRef.current)
    // Re-add labels on top so they stay above base
    if (labelLayerRef.current) {
      labelLayerRef.current.remove()
      if (labelsOn) labelLayerRef.current.addTo(mapRef.current)
    }
  }, [activeLayer])

  // Toggle labels overlay
  useEffect(() => {
    if (!mapRef.current || !labelLayerRef.current) return
    if (labelsOn) {
      labelLayerRef.current.addTo(mapRef.current)
    } else {
      labelLayerRef.current.remove()
    }
  }, [labelsOn])

  function flyTo(hotspot) {
    if (!mapRef.current) return
    mapRef.current.flyTo([hotspot.lat, hotspot.lng], hotspot.zoom, { duration: 1.2 })
  }

  return (
    <div style={{
      background: '#060f1a',
      border: '1px solid rgba(0,212,255,0.2)',
      borderRadius: 4,
      overflow: 'hidden',
      width: '100%',
      boxSizing: 'border-box',
    }}>

      {/* ── Header bar ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 12px',
        borderBottom: '1px solid rgba(0,212,255,0.15)',
        background: 'rgba(0,212,255,0.02)',
        gap: 8, flexWrap: 'wrap',
      }}>
        <div style={{ fontFamily: orb, fontSize: 9, letterSpacing: 3, color: '#00d4ff', fontWeight: 700 }}>
          SATELLITE IMAGERY
        </div>

        <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Base layer switcher */}
          {LAYERS.map(l => (
            <button key={l.id} onClick={() => setActiveLayer(l.id)} style={{
              background: activeLayer === l.id ? 'rgba(0,212,255,0.15)' : 'none',
              border: `1px solid ${activeLayer === l.id ? '#00d4ff' : 'rgba(0,212,255,0.2)'}`,
              borderRadius: 2, color: activeLayer === l.id ? '#00d4ff' : 'rgba(180,220,255,0.45)',
              fontFamily: mono, fontSize: 7, letterSpacing: 1,
              padding: '2px 7px', cursor: 'pointer', transition: 'all 0.15s',
            }}>{l.label}</button>
          ))}

          {/* Divider */}
          <div style={{ width: 1, height: 14, background: 'rgba(0,212,255,0.15)' }} />

          {/* Labels toggle */}
          <button onClick={() => setLabelsOn(v => !v)} style={{
            background: labelsOn ? 'rgba(255,179,0,0.12)' : 'none',
            border: `1px solid ${labelsOn ? '#ffb300' : 'rgba(0,212,255,0.2)'}`,
            borderRadius: 2, color: labelsOn ? '#ffb300' : 'rgba(180,220,255,0.4)',
            fontFamily: mono, fontSize: 7, letterSpacing: 1,
            padding: '2px 7px', cursor: 'pointer', transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span>🏷</span> LABELS {labelsOn ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* ── Hotspot quick-nav ── */}
      <div style={{
        display: 'flex', gap: 4, padding: '5px 10px', overflowX: 'auto',
        borderBottom: '1px solid rgba(0,212,255,0.08)',
        background: 'rgba(0,0,0,0.3)',
        scrollbarWidth: 'none',
      }}>
        {HOTSPOTS.map(h => (
          <button key={h.name} onClick={() => flyTo(h)} style={{
            background: 'none',
            border: '1px solid rgba(0,212,255,0.18)',
            borderRadius: 2, color: 'rgba(180,220,255,0.55)',
            fontFamily: mono, fontSize: 7, letterSpacing: 1,
            padding: '3px 8px', cursor: 'pointer', whiteSpace: 'nowrap',
            transition: 'all 0.15s', flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#00d4ff'; e.currentTarget.style.borderColor = 'rgba(0,212,255,0.5)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(180,220,255,0.55)'; e.currentTarget.style.borderColor = 'rgba(0,212,255,0.18)' }}
          >{h.name}</button>
        ))}
      </div>

      {/* ── Map ── */}
      <div style={{ position: 'relative' }}>
        <div ref={containerRef} style={{ width: '100%', height: 'clamp(260px, 38vh, 460px)' }} />

        {/* Loading overlay */}
        {!ready && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#060f1a',
            fontFamily: mono, fontSize: 10, color: 'rgba(180,220,255,0.4)', letterSpacing: 2,
          }}>
            LOADING SATELLITE FEED...
          </div>
        )}

        {/* HUD overlays */}
        {ready && (
          <>
            {/* Zoom + coords */}
            <div style={{
              position: 'absolute', bottom: 6, right: 8, zIndex: 1000,
              display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2,
              pointerEvents: 'none',
            }}>
              {coords && (
                <div style={{
                  fontFamily: mono, fontSize: 8, color: 'rgba(0,212,255,0.7)',
                  background: 'rgba(3,12,20,0.8)', padding: '2px 6px', borderRadius: 2,
                }}>
                  {coords.lat}° {coords.lng}°
                </div>
              )}
              <div style={{
                fontFamily: mono, fontSize: 8, color: 'rgba(0,212,255,0.5)',
                background: 'rgba(3,12,20,0.8)', padding: '2px 6px', borderRadius: 2,
              }}>
                Z{zoomLevel}
              </div>
            </div>

            {/* Zoom buttons */}
            <div style={{
              position: 'absolute', bottom: 6, left: 8, zIndex: 1000,
              display: 'flex', gap: 3,
            }}>
              {['+', '−'].map((label, i) => (
                <button key={label} onClick={() => mapRef.current?.[i === 0 ? 'zoomIn' : 'zoomOut']()} style={{
                  width: 24, height: 24,
                  background: 'rgba(3,12,20,0.85)',
                  border: '1px solid rgba(0,212,255,0.3)',
                  borderRadius: 2, color: '#00d4ff',
                  fontFamily: mono, fontSize: 13,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{label}</button>
              ))}
            </div>

            {/* Zone incoming banner */}
            {incomingZone && (
              <div style={{
                position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)',
                zIndex: 1001, pointerEvents: 'none',
                fontFamily: orb, fontSize: 9, letterSpacing: 2,
                color: '#ff3b3b',
                background: 'rgba(3,12,20,0.88)',
                border: '1px solid rgba(255,59,59,0.5)',
                padding: '4px 12px', borderRadius: 2,
                animation: 'zone-flash 3.5s ease forwards',
                whiteSpace: 'nowrap',
              }}>
                ▶ {incomingZone}
                <style>{`@keyframes zone-flash{0%{opacity:0;transform:translateX(-50%) translateY(-4px)}8%{opacity:1;transform:translateX(-50%) translateY(0)}80%{opacity:1}100%{opacity:0}}`}</style>
              </div>
            )}

            {/* Labels indicator */}
            {labelsOn && !incomingZone && (
              <div style={{
                position: 'absolute', top: 6, left: 8, zIndex: 1000,
                fontFamily: mono, fontSize: 7, color: '#ffb300',
                background: 'rgba(3,12,20,0.75)', padding: '2px 6px', borderRadius: 2,
                letterSpacing: 1, pointerEvents: 'none',
              }}>
                LABELS ACTIVE
              </div>
            )}

            {/* Subtle scan-line vignette */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999,
              pointerEvents: 'none',
              background: 'linear-gradient(to bottom, rgba(0,212,255,0.025) 0%, transparent 8%, transparent 92%, rgba(0,212,255,0.025) 100%)',
            }} />
          </>
        )}
      </div>
    </div>
  )
}
