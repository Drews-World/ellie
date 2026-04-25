import { useEffect, useCallback } from 'react'
import { useEllieStore } from '../../store'
import { worldApi } from '../../lib/api'
import Widget from '../shared/Widget'

const mono = "'Share Tech Mono', monospace"
const orb  = "'Orbitron', sans-serif"

const CITIES = ['Seattle', 'New York', 'London', 'Tokyo']
const REFRESH_MS = 30 * 60 * 1000   // 30 minutes

export default function WeatherWidget() {
  const { weather, setWeather } = useEllieStore()

  const fetchWeather = useCallback(() => {
    worldApi.getWeather(CITIES.join(',')).then(r => setWeather(r.data?.cities || {})).catch(() => {})
  }, [setWeather])

  useEffect(() => {
    if (!Object.keys(weather).length) fetchWeather()
    const id = setInterval(fetchWeather, REFRESH_MS)
    return () => clearInterval(id)
  }, [fetchWeather])

  const cities = weather.cities || weather

  return (
    <Widget title="ATMOSPHERIC" badge="GLOBAL" widgetKey="weather" detailTitle="WEATHER // ELLIE BRIEF">
      {CITIES.map(city => {
        const d = cities[city]
        const temp = d?.main?.temp
        const desc = d?.weather?.[0]?.description
        const humidity = d?.main?.humidity
        return (
          <div key={city} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '7px 0', borderBottom: '1px solid rgba(0,212,255,0.06)',
          }}>
            <span style={{ fontFamily: orb, fontSize: 9, letterSpacing: 1, color: '#00d4ff', width: 80 }}>
              {city.toUpperCase()}
            </span>
            <span style={{ fontFamily: mono, fontSize: 9, color: 'rgba(180,220,255,0.5)', flex: 1, textTransform: 'uppercase' }}>
              {desc ?? '—'}
            </span>
            <span style={{ fontFamily: mono, fontSize: 12, color: '#cceeff' }}>
              {temp != null ? `${Math.round(temp)}°F` : '—'}
            </span>
            {humidity != null && (
              <span style={{ fontFamily: mono, fontSize: 9, color: 'rgba(180,220,255,0.4)', marginLeft: 8 }}>
                {humidity}%
              </span>
            )}
          </div>
        )
      })}
    </Widget>
  )
}
