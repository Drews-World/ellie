/**
 * LiveFeedWidget — Live video imagery feeds
 *
 * Sources (all free, public embeds):
 *  News      — Al Jazeera English, Reuters Live, AP News Live (YouTube Live embeds)
 *  Satellite — NASA Worldview GIBS tiles (live/near-real-time)
 *  Weather   — Windy.com radar/wind embed
 *  Earth     — International Space Station (NASA ISS stream)
 *
 * Layout:
 *  Tab bar: NEWS | WEATHER | SATELLITE | ISS
 *  Large embed frame below
 */
import { useState } from 'react'

const orb  = "'Orbitron', sans-serif"
const mono = "'Share Tech Mono', monospace"
const raj  = "'Rajdhani', sans-serif"

// ── Feed definitions ─────────────────────────────────────────────────────────
const FEEDS = {
  NEWS: [
    {
      id: 'aljazeera',
      label: 'AL JAZEERA',
      type: 'youtube',
      // Al Jazeera English 24/7 live
      ytId: 'C9IVa2-Oy6c',
      desc: 'Al Jazeera English — 24/7 world news',
    },
    {
      id: 'bloomberg',
      label: 'BLOOMBERG',
      type: 'youtube',
      // Bloomberg TV live
      ytId: 'dp8PhLsUcFE',
      desc: 'Bloomberg Television — markets & geopolitics',
    },
    {
      id: 'reuters',
      label: 'REUTERS',
      type: 'youtube',
      ytId: 'XHFnKk0KZCE',
      desc: 'Reuters TV — global wire service',
    },
  ],
  WEATHER: [
    {
      id: 'windy',
      label: 'WINDY.COM',
      type: 'iframe',
      url: 'https://embed.windy.com/embed2.html?lat=47.6&lon=-122.3&detailLat=47.6&detailLon=-122.3&width=650&height=450&zoom=5&level=surface&overlay=wind&product=ecmwf&menu=&message=true&marker=true&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=default&metricTemp=default&radarRange=-1',
      desc: 'Live global wind & weather radar',
    },
    {
      id: 'earth-wind',
      label: 'EARTH WIND',
      type: 'iframe',
      url: 'https://embed.windy.com/embed2.html?lat=30&lon=0&detailLat=30&detailLon=0&width=650&height=450&zoom=2&level=surface&overlay=wind&menu=&message=true',
      desc: 'Earth wind map — global atmospheric flow',
    },
  ],
  SATELLITE: [
    {
      id: 'nasa-worldview',
      label: 'NASA WORLDVIEW',
      type: 'iframe',
      url: 'https://worldview.earthdata.nasa.gov/?v=-180,-90,180,90&l=VIIRS_SNPP_CorrectedReflectance_TrueColor(hidden),MODIS_Terra_CorrectedReflectance_TrueColor,Coastlines_15m&lg=false&t=2025-01-15',
      desc: 'NASA GIBS — near-real-time satellite imagery',
    },
    {
      id: 'fire-map',
      label: 'ACTIVE FIRES',
      type: 'iframe',
      url: 'https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;@0.0,20.0,3z',
      desc: 'NASA FIRMS — active fire & hotspot detection',
    },
  ],
  ISS: [
    {
      id: 'iss-live',
      label: 'ISS LIVE',
      type: 'youtube',
      ytId: '86YLFOog4GM',
      desc: 'NASA ISS — live Earth view from orbit (when crew awake)',
    },
    {
      id: 'iss-tracker',
      label: 'ISS TRACKER',
      type: 'iframe',
      url: 'https://isstracker.spaceflight.esa.int/en/',
      desc: 'ESA ISS real-time orbital tracker',
    },
  ],
}

const TABS = Object.keys(FEEDS)

export default function LiveFeedWidget() {
  const [activeTab, setActiveTab]   = useState('NEWS')
  const [activeFeed, setActiveFeed] = useState(FEEDS.NEWS[0])
  const [loaded, setLoaded]         = useState(false)

  const switchFeed = (feed) => {
    setActiveFeed(feed)
    setLoaded(false)
  }

  const switchTab = (tab) => {
    setActiveTab(tab)
    setActiveFeed(FEEDS[tab][0])
    setLoaded(false)
  }

  const embedSrc = activeFeed.type === 'youtube'
    ? `https://www.youtube.com/embed/${activeFeed.ytId}?autoplay=1&mute=1&controls=1&rel=0&modestbranding=1&iv_load_policy=3`
    : activeFeed.url

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
        padding: '7px 12px 0',
        borderBottom: '1px solid rgba(95,208,216,0.1)',
        background: 'rgba(95,208,216,0.02)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontFamily: orb, fontSize: 9, letterSpacing: 3, color: '#5FD0D8', fontWeight: 700 }}>
            LIVE FEEDS
          </span>
          {/* Live indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%', background: '#ff3b3b',
              animation: 'live-blink 2s ease infinite',
            }} />
            <style>{`@keyframes live-blink{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
            <span style={{ fontFamily: mono, fontSize: 7, color: '#ff3b3b', letterSpacing: 1 }}>LIVE</span>
          </div>
        </div>

        {/* Category tabs */}
        <div style={{ display: 'flex', gap: 0 }}>
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => switchTab(tab)}
              style={{
                background: activeTab === tab ? 'rgba(95,208,216,0.1)' : 'none',
                border: 'none',
                borderBottom: `2px solid ${activeTab === tab ? '#5FD0D8' : 'transparent'}`,
                color: activeTab === tab ? '#5FD0D8' : 'rgba(180,220,255,0.35)',
                fontFamily: mono, fontSize: 7, letterSpacing: 1,
                padding: '4px 10px', cursor: 'pointer',
                transition: 'all 0.12s',
              }}
            >{tab}</button>
          ))}
        </div>
      </div>

      {/* ── Source sub-selector ── */}
      <div style={{
        display: 'flex', gap: 5, padding: '6px 12px',
        borderBottom: '1px solid rgba(95,208,216,0.08)',
        flexWrap: 'wrap',
      }}>
        {FEEDS[activeTab].map(feed => (
          <button
            key={feed.id}
            onClick={() => switchFeed(feed)}
            style={{
              background: activeFeed.id === feed.id ? 'rgba(95,208,216,0.12)' : 'rgba(95,208,216,0.03)',
              border: `1px solid ${activeFeed.id === feed.id ? 'rgba(95,208,216,0.5)' : 'rgba(95,208,216,0.12)'}`,
              borderRadius: 2,
              color: activeFeed.id === feed.id ? '#5FD0D8' : 'rgba(180,220,255,0.45)',
              fontFamily: mono, fontSize: 7, letterSpacing: 1,
              padding: '2px 8px', cursor: 'pointer', transition: 'all 0.12s',
            }}
          >{feed.label}</button>
        ))}
      </div>

      {/* ── Embed frame ── */}
      <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%' /* 16:9 */ }}>
        {!loaded && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 2,
            background: '#060f1a',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <div style={{ fontFamily: mono, fontSize: 9, color: 'rgba(180,220,255,0.3)', letterSpacing: 2 }}>
              ACQUIRING SIGNAL...
            </div>
            <div style={{ fontFamily: raj, fontSize: 10, color: 'rgba(180,220,255,0.2)' }}>
              {activeFeed.desc}
            </div>
          </div>
        )}
        <iframe
          key={activeFeed.id}
          src={embedSrc}
          title={activeFeed.label}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          onLoad={() => setLoaded(true)}
          style={{
            position: 'absolute', top: 0, left: 0,
            width: '100%', height: '100%',
            border: 'none',
          }}
        />
      </div>

      {/* ── Feed description ── */}
      <div style={{
        padding: '4px 12px',
        borderTop: '1px solid rgba(95,208,216,0.06)',
        fontFamily: mono, fontSize: 7,
        color: 'rgba(180,220,255,0.25)',
        letterSpacing: 1,
      }}>
        {activeFeed.desc.toUpperCase()}
      </div>
    </div>
  )
}
