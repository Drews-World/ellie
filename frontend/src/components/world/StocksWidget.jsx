import { useEffect, useCallback } from 'react'
import { useEllieStore } from '../../store'
import { worldApi } from '../../lib/api'
import Widget from '../shared/Widget'

const mono = "'Share Tech Mono', monospace"
const orb  = "'Orbitron', sans-serif"

const SYMBOLS = ['SPY', 'AAPL', 'NVDA', 'TSLA', 'AMZN', 'MSFT', 'GOOGL', 'META']
const REFRESH_MS = 60 * 60 * 1000   // 1 hour

function pct(o, c) {
  if (!o || !c) return null
  return (((c - o) / o) * 100).toFixed(2)
}

export default function StocksWidget() {
  const { markets, setMarkets } = useEllieStore()

  const fetchMarkets = useCallback(() => {
    worldApi.getStocks().then(r => setMarkets(r.data?.tickers || {})).catch(() => {})
  }, [setMarkets])

  useEffect(() => {
    if (!Object.keys(markets).length) fetchMarkets()
    const id = setInterval(fetchMarkets, REFRESH_MS)
    return () => clearInterval(id)
  }, [fetchMarkets])

  const tickers = markets.tickers || markets

  return (
    <Widget title="MARKETS" badge="EQUITIES" widgetKey="stocks" detailTitle="MARKETS // ELLIE BRIEF">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {SYMBOLS.map(sym => {
          const t = tickers[sym]
          const change = t ? pct(t.o, t.c) : null
          const up = change !== null && parseFloat(change) >= 0
          return (
            <div key={sym} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 6px',
              borderBottom: '1px solid rgba(0,212,255,0.06)',
            }}>
              <span style={{ fontFamily: orb, fontSize: 8, letterSpacing: 1, color: '#00d4ff', width: 44 }}>{sym}</span>
              <span style={{ fontFamily: mono, fontSize: 10, color: '#cceeff', flex: 1, textAlign: 'right', marginRight: 8 }}>
                {t ? `$${t.c?.toFixed(2)}` : '—'}
              </span>
              <span style={{
                fontFamily: mono, fontSize: 9,
                color: change === null ? 'rgba(180,220,255,0.3)' : up ? '#00ff9d' : '#ff3b3b',
                width: 56, textAlign: 'right',
              }}>
                {change !== null ? `${up ? '▲' : '▼'} ${Math.abs(change)}%` : '—'}
              </span>
            </div>
          )
        })}
      </div>
    </Widget>
  )
}
