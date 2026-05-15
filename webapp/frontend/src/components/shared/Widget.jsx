import { useEllieStore } from '../../store'
import soundEngine from '../../lib/soundEngine'

export default function Widget({ title, badge, badgeType = 'default', widgetKey, detailTitle, children }) {
  const { openDetail, pulsingWidgets } = useEllieStore()
  const isPulsing = widgetKey && !!pulsingWidgets[widgetKey]

  const badgeColors = {
    default: { bg: 'rgba(0,212,255,0.15)', color: '#00d4ff', border: 'rgba(0,212,255,0.3)' },
    red:     { bg: 'rgba(255,59,59,0.15)', color: '#ff3b3b', border: 'rgba(255,59,59,0.3)' },
    amber:   { bg: 'rgba(255,179,0,0.15)', color: '#ffb300', border: 'rgba(255,179,0,0.3)' },
    green:   { bg: 'rgba(0,255,157,0.15)', color: '#00ff9d', border: 'rgba(0,255,157,0.3)' },
  }

  const bc = badgeColors[badgeType] || badgeColors.default

  return (
    <div
      className={`widget${isPulsing ? ' widget-pulse' : ''}`}
      data-widget-id={widgetKey || 'widget'}
      onClick={() => { if (widgetKey) { soundEngine.confirm(); openDetail(widgetKey, detailTitle || title) } }}
      style={{ cursor: widgetKey ? 'pointer' : 'default' }}
    >
      <div className="widget-header">
        <div className="widget-title">{title}</div>
        {badge && (
          <div style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: 9, padding: '2px 6px', borderRadius: 2,
            background: bc.bg, color: bc.color, border: `1px solid ${bc.border}`,
          }}>
            {badge}
          </div>
        )}
      </div>
      <div className="widget-body">{children}</div>
      {widgetKey && (
        <div style={{
          position: 'absolute', bottom: 8, right: 10,
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: 9, color: 'rgba(180,220,255,0.4)',
          opacity: 0, transition: 'opacity 0.2s',
          pointerEvents: 'none',
        }} className="expand-hint">
          EXPAND ↗
        </div>
      )}
    </div>
  )
}
