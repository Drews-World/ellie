export default function Ticker() {
  const items = [
    '▲ SPY +0.84%', 'BTC $94,420', '⚡ BREAKING: Fed holds rates steady',
    'AAPL $211.40 ▲', 'Gold $2,381/oz', '⚡ NBA: Celtics vs Heat — 4Q 108-102',
    'ETH $3,241 ▲', 'WTI Crude $78.4', '⚡ NATO summit convenes in Brussels',
    'TSLA $172.80 ▼', 'VIX 14.2',
  ]
  const doubled = [...items, ...items]

  return (
    <div style={{
      background: 'linear-gradient(165deg, #0d2329 0%, #081519 100%)',
      border: '1px solid rgba(95,208,216,0.20)',
      borderRadius: 'var(--bp-r-md)',
      boxShadow: 'var(--bp-shadow-md), inset 0 1px 0 rgba(255,255,255,0.05)',
      overflow: 'hidden', height: 30,
      display: 'flex', alignItems: 'center',
      padding: '0 12px', gap: 12,
    }}>
      <div style={{
        fontFamily: "'Orbitron', sans-serif",
        fontSize: 9, letterSpacing: 2,
        color: '#ffb300', whiteSpace: 'nowrap',
        border: '1px solid #ffb300',
        padding: '2px 6px', flexShrink: 0,
      }}>LIVE</div>
      <div style={{ overflow: 'hidden', flex: 1 }}>
        <div style={{
          display: 'flex', gap: 40, whiteSpace: 'nowrap',
          animation: 'ticker-scroll 50s linear infinite',
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: 11, color: 'rgba(180,220,255,0.5)',
        }}>
          {doubled.map((item, i) => (
            <span key={i} style={{ color: item.startsWith('⚡') ? '#5FD0D8' : undefined }}>
              {item}
            </span>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}
