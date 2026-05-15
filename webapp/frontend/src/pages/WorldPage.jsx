import NewsWidget      from '../components/world/NewsWidget'
import StocksWidget    from '../components/world/StocksWidget'
import CryptoWidget    from '../components/world/CryptoWidget'
import WeatherWidget   from '../components/world/WeatherWidget'
import SportsWidget    from '../components/world/SportsWidget'
import ThreatWidget    from '../components/world/ThreatWidget'
import MapWidget       from '../components/world/MapWidget'
import SatelliteWidget from '../components/world/SatelliteWidget'
import FlightWidget    from '../components/world/FlightWidget'
import PoliceWidget    from '../components/world/PoliceWidget'
import LiveFeedWidget  from '../components/world/LiveFeedWidget'
import EllieAvatar     from '../components/shared/EllieAvatar'
import Ticker          from '../components/world/Ticker'
import DetailOverlay   from '../components/world/DetailOverlay'
import { useWorldStore } from '../store/worldStore'
import styles from './WorldPage.module.css'

export default function WorldPage() {
  const activeWidget = useWorldStore(s => s.activeWidget)

  return (
    <div className={styles.root}>
      <Ticker />
      <div className={styles.grid}>

        {/* ── Left column: News / Threat / Weather ── */}
        <div className={styles.colLeft}>
          <NewsWidget />
          <ThreatWidget />
          <WeatherWidget />
        </div>

        {/* ── Centre-left: 2×2 sub-grid ───────────────
            Row 1: [LiveFeed  |  Globe]
            Row 2: [Avatar    |  Flight]
        ─────────────────────────────────────────── */}
        <div className={styles.colGlobe}>

          {/* Top row — equal halves */}
          <div className={styles.halfRow}>
            <div className={styles.halfCell}>
              <LiveFeedWidget />
            </div>
            <div className={styles.halfCell}>
              <MapWidget />
            </div>
          </div>

          {/* Bottom row — equal halves */}
          <div className={styles.halfRow}>
            <div className={styles.halfCell} style={{ minHeight: 280 }}>
              <EllieAvatar />
            </div>
            <div className={styles.halfCell}>
              <FlightWidget />
            </div>
          </div>

        </div>

        {/* ── Centre-right: Satellite / Police ── */}
        <div className={styles.colSat}>
          <SatelliteWidget />
          <PoliceWidget />
        </div>

        {/* ── Right column: Sports / Crypto / Markets ── */}
        <div className={styles.colRight}>
          <SportsWidget />
          <CryptoWidget />
          <StocksWidget />
        </div>

      </div>
      {activeWidget && <DetailOverlay />}
    </div>
  )
}
