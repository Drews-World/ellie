import { useEffect } from 'react'
import { useEllieStore } from '../store'
import { getNews, getMarkets, getCrypto, getWeather, getSports, getThreatMatrix } from '../lib/api'
import WorldNewsWidget from '../components/world/WorldNewsWidget'
import ThreatMatrixWidget from '../components/world/ThreatMatrixWidget'
import WeatherWidget from '../components/world/WeatherWidget'
import GlobalMapWidget from '../components/world/GlobalMapWidget'
import MarketsWidget from '../components/world/MarketsWidget'
import SportsWidget from '../components/world/SportsWidget'
import CryptoWidget from '../components/world/CryptoWidget'
import RacingWidget from '../components/world/RacingWidget'
import EllieStatusWidget from '../components/world/EllieStatusWidget'

export default function WorldView() {
  const { setNews, setMarkets, setCrypto, setWeather, setSports, setThreatMatrix } = useEllieStore()

  useEffect(() => {
    // Fetch all world data on mount
    const fetchAll = async () => {
      try {
        const [news, markets, crypto, weather, sports, threat] = await Promise.allSettled([
          getNews(),
          getMarkets(),
          getCrypto(),
          getWeather(['Seattle', 'New York', 'London', 'Tokyo']),
          getSports(['nba', 'nfl', 'mlb']),
          getThreatMatrix(),
        ])

        if (news.status === 'fulfilled') setNews(news.value.data)
        if (markets.status === 'fulfilled') setMarkets(markets.value.data)
        if (crypto.status === 'fulfilled') setCrypto(crypto.value.data)
        if (weather.status === 'fulfilled') setWeather(weather.value.data)
        if (sports.status === 'fulfilled') setSports(sports.value.data)
        if (threat.status === 'fulfilled') setThreatMatrix(threat.value.data)
      } catch (err) {
        console.error('Feed fetch error:', err)
      }
    }

    fetchAll()

    // Refresh feeds every 60 seconds
    const interval = setInterval(fetchAll, 60_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '260px 1fr 260px',
      gap: 10,
      padding: 10,
      minHeight: 'calc(100vh - 90px)',
    }}>
      {/* LEFT */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <WorldNewsWidget />
        <ThreatMatrixWidget />
        <WeatherWidget />
      </div>

      {/* CENTER */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <GlobalMapWidget />
        <MarketsWidget />
      </div>

      {/* RIGHT */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SportsWidget />
        <CryptoWidget />
        <RacingWidget />
        <EllieStatusWidget />
      </div>
    </div>
  )
}
