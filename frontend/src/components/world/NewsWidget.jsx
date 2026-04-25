import { useEffect, useCallback } from 'react'
import { useEllieStore } from '../../store'
import { worldApi } from '../../lib/api'
import Widget from '../shared/Widget'

const mono = "'Share Tech Mono', monospace"
const raj  = "'Rajdhani', sans-serif"

const REFRESH_MS = 60 * 60 * 1000   // 1 hour

export default function NewsWidget() {
  const { news, setNews } = useEllieStore()

  const fetchNews = useCallback(() => {
    worldApi.getNews().then(r => setNews(r.data?.articles || [])).catch(() => {})
  }, [setNews])

  useEffect(() => {
    if (!news.length) fetchNews()
    const id = setInterval(fetchNews, REFRESH_MS)
    return () => clearInterval(id)
  }, [fetchNews])

  return (
    <Widget title="INTELLIGENCE FEED" badge={`${news.length} ITEMS`} widgetKey="world-news" detailTitle="WORLD NEWS // ELLIE BRIEF">
      {news.length === 0 ? (
        <div style={{ fontFamily: mono, fontSize: 10, color: 'rgba(180,220,255,0.3)', textAlign: 'center', padding: '12px 0' }}>
          ACQUIRING FEED...
        </div>
      ) : (
        news.slice(0, 6).map((article, i) => (
          <a
            key={i}
            href={article.url}
            target="_blank"
            rel="noreferrer"
            style={{ display: 'block', textDecoration: 'none', cursor: 'pointer' }}
          >
            <div style={{
              padding: '7px 0',
              borderBottom: '1px solid rgba(0,212,255,0.06)',
              transition: 'background 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,212,255,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ fontFamily: raj, fontSize: 11, color: '#cceeff', lineHeight: 1.4, marginBottom: 3 }}>
                {article.title}
              </div>
              <div style={{ fontFamily: mono, fontSize: 9, color: 'rgba(180,220,255,0.35)', display: 'flex', gap: 10, alignItems: 'center' }}>
                <span>{article.source?.name?.toUpperCase()}</span>
                {article.publishedAt && (
                  <span>{new Date(article.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                )}
                <span style={{ color: 'rgba(0,212,255,0.4)', marginLeft: 'auto' }}>↗</span>
              </div>
            </div>
          </a>
        ))
      )}
    </Widget>
  )
}
