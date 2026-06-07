import { useEffect, useState } from 'react'
import { useEllieStore } from '../../store'
import { ellieQuery } from '../../lib/api'

export default function DetailPanel() {
  const { detailOpen, detailWidget, detailTitle, closeDetail } = useEllieStore()
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!detailWidget) return
    setLoading(true)
    setError(false)
    setContent('')

    ellieQuery(detailWidget)
      .then(res => {
        setContent(res.data.brief || '')
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [detailWidget])

  if (!detailOpen) return null

  const formatContent = (text) => text
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#5FD0D8">$1</strong>')
    .replace(/\n\n/g, '</p><p style="margin-bottom:12px">')
    .replace(/\n/g, '<br>')

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && closeDetail()}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(2,10,20,0.97)',
        zIndex: 500,
        overflowY: 'auto',
        animation: 'fade-in 0.2s ease',
      }}
    >
      <div style={{ maxWidth: 900, margin: '20px auto', padding: '0 16px 40px' }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 0',
          borderBottom: '1px solid rgba(95,208,216,0.25)',
          marginBottom: 20,
        }}>
          <div>
            <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 14, letterSpacing: 4, color: '#5FD0D8' }}>
              {detailTitle}
            </div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: 'rgba(180,220,255,0.4)', letterSpacing: 2, marginTop: 3 }}>
              ELLIE // EXECUTIVE LIFE LOGIC INTELLIGENCE ENGINE // DREW COMMAND
            </div>
          </div>
          <button
            onClick={closeDetail}
            style={{
              fontFamily: "'Orbitron', sans-serif",
              fontSize: 10, letterSpacing: 2,
              background: 'none',
              border: '1px solid rgba(95,208,216,0.25)',
              padding: '6px 14px',
              cursor: 'pointer',
              borderRadius: 2,
              color: '#5FD0D8',
              transition: 'all 0.2s',
            }}
            onMouseOver={e => e.target.style.background = 'rgba(95,208,216,0.15)'}
            onMouseOut={e => e.target.style.background = 'none'}
          >
            ← BACK
          </button>
        </div>

        {/* Content */}
        <div style={{
          background: '#060f1a',
          border: '1px solid rgba(95,208,216,0.25)',
          borderRadius: 4,
          padding: 20,
          minHeight: 200,
        }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '20px 0' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{
                    width: 6, height: 6,
                    background: '#5FD0D8',
                    borderRadius: '50%',
                    animation: `dot-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
              <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: 'rgba(180,220,255,0.5)' }}>
                ELLIE IS PROCESSING...
              </span>
            </div>
          )}

          {error && (
            <div style={{ color: '#ff3b3b', fontFamily: "'Share Tech Mono', monospace", fontSize: 12 }}>
              Feed connection interrupted. Check API configuration. — ELLIE
            </div>
          )}

          {!loading && !error && (
            <div style={{ animation: 'slide-up 0.3s ease' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 9, letterSpacing: 3,
                color: '#5FD0D8',
                marginBottom: 16,
              }}>
                ELLIE // INTELLIGENCE BRIEF FOR DREW
                <div style={{ flex: 1, height: 1, background: 'rgba(95,208,216,0.2)' }} />
              </div>
              <div
                style={{ fontSize: 14, lineHeight: 1.8, color: '#cceeff' }}
                dangerouslySetInnerHTML={{ __html: `<p style="margin-bottom:12px">${formatContent(content)}</p>` }}
              />
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes dot-bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
