import { useEffect, useState } from 'react'
import Widget from '../shared/Widget'
import api from '../../lib/api'

const mono = "'Share Tech Mono', monospace"
const orb  = "'Orbitron', sans-serif"
const raj  = "'Rajdhani', sans-serif"

const CATEGORIES = ['general', 'family', 'health', 'work', 'quill', 'relationships', 'gratitude']

export default function PrayerWidget() {
  const [items, setItems]         = useState([])
  const [tab, setTab]             = useState('active')   // 'active' | 'answered'
  const [adding, setAdding]       = useState(false)
  const [newTitle, setNewTitle]   = useState('')
  const [newCat, setNewCat]       = useState('general')
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    api.get('/prayer')
      .then(r => setItems(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const active   = items.filter(i => i.status === 'active')
  const answered = items.filter(i => i.status === 'answered')
  const visible  = tab === 'active' ? active : answered

  async function handleAdd() {
    if (!newTitle.trim()) return
    try {
      const r = await api.post('/prayer', { title: newTitle.trim(), category: newCat })
      setItems(prev => [r.data, ...prev])
      setNewTitle('')
      setNewCat('general')
      setAdding(false)
    } catch {}
  }

  async function markAnswered(item) {
    try {
      const r = await api.put(`/prayer/${item.id}`, { status: 'answered' })
      setItems(prev => prev.map(i => i.id === item.id ? r.data : i))
    } catch {}
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/prayer/${id}`)
      setItems(prev => prev.filter(i => i.id !== id))
    } catch {}
  }

  const CAT_COLOR = {
    family: '#ffb300', health: '#00ff9d', work: '#00d4ff',
    quill: '#a78bfa', relationships: '#f472b6',
    gratitude: '#34d399', general: 'rgba(180,220,255,0.4)',
  }

  return (
    <Widget title="PRAYER BOARD" badge={`${active.length} ACTIVE`} widgetKey="prayer">
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {['active', 'answered'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '4px 0',
              background: tab === t ? 'rgba(0,212,255,0.12)' : 'none',
              border: `1px solid ${tab === t ? 'var(--hud)' : 'rgba(0,212,255,0.15)'}`,
              borderRadius: 2,
              color: tab === t ? '#00d4ff' : 'rgba(180,220,255,0.4)',
              fontFamily: orb,
              fontSize: 8,
              letterSpacing: 2,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {t.toUpperCase()} {t === 'active' ? `(${active.length})` : `(${answered.length})`}
          </button>
        ))}
      </div>

      {/* Item list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minHeight: 60 }}>
        {loading && (
          <div style={{ fontFamily: mono, fontSize: 9, color: 'rgba(180,220,255,0.3)', padding: '8px 0' }}>
            LOADING...
          </div>
        )}
        {!loading && visible.length === 0 && (
          <div style={{ fontFamily: mono, fontSize: 9, color: 'rgba(180,220,255,0.25)', padding: '8px 0' }}>
            {tab === 'active' ? 'NO ACTIVE PRAYER ITEMS' : 'NO ANSWERED PRAYERS YET'}
          </div>
        )}
        {visible.map(item => (
          <div key={item.id} style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            padding: '6px 8px',
            background: 'rgba(0,212,255,0.02)',
            border: '1px solid rgba(0,212,255,0.08)',
            borderRadius: 2,
          }}>
            {/* Category dot */}
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: CAT_COLOR[item.category] || CAT_COLOR.general,
              marginTop: 4, flexShrink: 0,
              boxShadow: `0 0 5px ${CAT_COLOR[item.category] || CAT_COLOR.general}`,
            }} />
            {/* Title */}
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: raj, fontSize: 12, color: tab === 'answered' ? 'rgba(180,220,255,0.45)' : '#cceeff',
                textDecoration: tab === 'answered' ? 'line-through' : 'none',
                lineHeight: 1.4,
              }}>{item.title}</div>
              {tab === 'answered' && item.answered_at && (
                <div style={{ fontFamily: mono, fontSize: 8, color: '#00ff9d', marginTop: 2 }}>
                  ✓ ANSWERED {new Date(item.answered_at).toLocaleDateString()}
                </div>
              )}
            </div>
            {/* Actions */}
            {tab === 'active' && (
              <button
                onClick={() => markAnswered(item)}
                title="Mark as answered"
                style={{
                  background: 'none',
                  border: '1px solid rgba(0,255,157,0.3)',
                  borderRadius: 2,
                  color: '#00ff9d',
                  fontSize: 11,
                  width: 24, height: 24,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,255,157,0.12)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >✓</button>
            )}
            <button
              onClick={() => handleDelete(item.id)}
              style={{
                background: 'none', border: 'none',
                color: 'rgba(180,220,255,0.2)', fontSize: 14,
                cursor: 'pointer', padding: '0 2px', lineHeight: 1,
                flexShrink: 0,
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#ff3b3b'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(180,220,255,0.2)'}
            >×</button>
          </div>
        ))}
      </div>

      {/* Add form */}
      {adding ? (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            autoFocus
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false) }}
            placeholder="Enter prayer item..."
            style={{
              background: 'rgba(0,212,255,0.04)',
              border: '1px solid rgba(0,212,255,0.3)',
              borderRadius: 2, color: '#cceeff',
              fontFamily: raj, fontSize: 12,
              padding: '6px 10px', outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <select
              value={newCat}
              onChange={e => setNewCat(e.target.value)}
              style={{
                flex: 1,
                background: 'rgba(0,212,255,0.04)',
                border: '1px solid rgba(0,212,255,0.2)',
                borderRadius: 2, color: 'rgba(180,220,255,0.7)',
                fontFamily: mono, fontSize: 9, padding: '4px 6px',
              }}
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
            </select>
            <button onClick={handleAdd} style={{
              background: 'rgba(0,212,255,0.12)',
              border: '1px solid var(--hud)', borderRadius: 2,
              color: '#00d4ff', fontFamily: orb, fontSize: 8,
              letterSpacing: 1, padding: '0 12px', cursor: 'pointer',
            }}>ADD</button>
            <button onClick={() => setAdding(false)} style={{
              background: 'none', border: '1px solid rgba(0,212,255,0.15)',
              borderRadius: 2, color: 'rgba(180,220,255,0.4)',
              fontFamily: mono, fontSize: 9, padding: '0 10px', cursor: 'pointer',
            }}>✕</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          style={{
            marginTop: 10, width: '100%',
            background: 'none',
            border: '1px dashed rgba(0,212,255,0.2)',
            borderRadius: 2, color: 'rgba(180,220,255,0.4)',
            fontFamily: mono, fontSize: 9,
            letterSpacing: 1, padding: '6px 0',
            cursor: 'pointer', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(0,212,255,0.5)'; e.currentTarget.style.color = '#00d4ff' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,212,255,0.2)'; e.currentTarget.style.color = 'rgba(180,220,255,0.4)' }}
        >+ ADD PRAYER ITEM</button>
      )}
    </Widget>
  )
}
