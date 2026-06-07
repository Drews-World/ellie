import { useEffect, useCallback } from 'react'
import { useEllieStore } from '../../store'
import { worldApi } from '../../lib/api'
import Widget from '../shared/Widget'

const mono = "'Share Tech Mono', monospace"
const orb  = "'Orbitron', sans-serif"

const COINS = [
  { id: 'bitcoin',       label: 'BTC' },
  { id: 'ethereum',      label: 'ETH' },
  { id: 'solana',        label: 'SOL' },
  { id: 'cardano',       label: 'ADA' },
  { id: 'tether-gold',   label: 'GOLD' },
]
const REFRESH_MS = 60 * 60 * 1000   // 1 hour

export default function CryptoWidget() {
  const { crypto, setCrypto } = useEllieStore()

  const fetchCrypto = useCallback(() => {
    worldApi.getCrypto().then(r => setCrypto(r.data || {})).catch(() => {})
  }, [setCrypto])

  useEffect(() => {
    if (!Object.keys(crypto).length) fetchCrypto()
    const id = setInterval(fetchCrypto, REFRESH_MS)
    return () => clearInterval(id)
  }, [fetchCrypto])

  return (
    <Widget title="CRYPTO / GOLD" badge="LIVE" badgeType="amber" widgetKey="crypto" detailTitle="CRYPTO // ELLIE BRIEF">
      {COINS.map(({ id, label }) => {
        const coin = crypto[id]
        const price = coin?.usd
        const change = coin?.usd_24h_change
        const up = change >= 0
        return (
          <div key={id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '7px 0', borderBottom: '1px solid rgba(95,208,216,0.06)',
          }}>
            <span style={{ fontFamily: orb, fontSize: 9, letterSpacing: 1, color: '#5FD0D8', width: 44 }}>{label}</span>
            <span style={{ fontFamily: mono, fontSize: 12, color: '#cceeff', flex: 1, textAlign: 'right' }}>
              {price != null ? `$${price.toLocaleString()}` : '—'}
            </span>
            {change != null && (
              <span style={{ fontFamily: mono, fontSize: 9, color: up ? '#00ff9d' : '#ff3b3b', width: 60, textAlign: 'right' }}>
                {up ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
              </span>
            )}
          </div>
        )
      })}
    </Widget>
  )
}
