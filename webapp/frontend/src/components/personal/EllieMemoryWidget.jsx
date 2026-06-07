import { useState } from 'react'
import { useEllieStore } from '../../store'
import Widget from '../shared/Widget'

const mono = "'Share Tech Mono', monospace"
const orb  = "'Orbitron', sans-serif"

export default function EllieMemoryWidget() {
  const { ellieContext, setEllieContext } = useEllieStore()
  const [showAdd, setShowAdd] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newVal, setNewVal] = useState('')

  const entries = Object.entries(ellieContext)

  const handleAdd = () => {
    if (!newKey.trim()) return
    setEllieContext({ ...ellieContext, [newKey.trim()]: newVal.trim() })
    setNewKey('')
    setNewVal('')
    setShowAdd(false)
  }

  const handleRemove = (key) => {
    const next = { ...ellieContext }
    delete next[key]
    setEllieContext(next)
  }

  return (
    <Widget title="ELLIE MEMORY" badge={`${entries.length} ENTRIES`} badgeType={entries.length > 0 ? 'default' : 'amber'}>
      <div style={{ marginBottom: 8, fontFamily: mono, fontSize: 9, color: 'rgba(180,220,255,0.4)', lineHeight: 1.5 }}>
        Context AJH has stored for ELLIE to reference.
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button
          onClick={(e) => { e.stopPropagation(); setShowAdd(!showAdd) }}
          style={{
            fontFamily: orb, fontSize: 8, letterSpacing: 1,
            background: 'rgba(95,208,216,0.1)', border: '1px solid rgba(95,208,216,0.3)',
            color: '#5FD0D8', padding: '3px 8px', borderRadius: 2, cursor: 'pointer',
          }}
        >+ ADD</button>
      </div>

      {showAdd && (
        <div onClick={e => e.stopPropagation()} style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            placeholder="Key (e.g. preferred_name)"
            value={newKey}
            onChange={e => setNewKey(e.target.value)}
            style={{
              background: 'rgba(95,208,216,0.05)', border: '1px solid rgba(95,208,216,0.2)',
              color: '#cceeff', padding: '6px 8px', borderRadius: 2,
              fontFamily: mono, fontSize: 11, width: '100%',
            }}
          />
          <input
            placeholder="Value"
            value={newVal}
            onChange={e => setNewVal(e.target.value)}
            style={{
              background: 'rgba(95,208,216,0.05)', border: '1px solid rgba(95,208,216,0.2)',
              color: '#cceeff', padding: '6px 8px', borderRadius: 2,
              fontFamily: mono, fontSize: 11, width: '100%',
            }}
          />
          <button
            onClick={handleAdd}
            style={{
              background: 'rgba(95,208,216,0.15)', border: '1px solid rgba(95,208,216,0.4)',
              color: '#5FD0D8', fontFamily: orb, fontSize: 8, letterSpacing: 2,
              padding: '6px', borderRadius: 2, cursor: 'pointer',
            }}
          >STORE</button>
        </div>
      )}

      {entries.length === 0 ? (
        <div style={{ fontFamily: mono, fontSize: 10, color: 'rgba(180,220,255,0.3)', textAlign: 'center', padding: '8px 0' }}>
          NO MEMORY LOADED
        </div>
      ) : (
        entries.map(([k, v]) => (
          <div key={k} style={{
            display: 'flex', gap: 8, alignItems: 'flex-start',
            padding: '5px 0', borderBottom: '1px solid rgba(95,208,216,0.06)',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: orb, fontSize: 8, letterSpacing: 1, color: '#5FD0D8', marginBottom: 2 }}>
                {k.toUpperCase()}
              </div>
              <div style={{ fontFamily: mono, fontSize: 10, color: 'rgba(180,220,255,0.7)' }}>{v}</div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); handleRemove(k) }}
              style={{ background: 'none', border: 'none', color: 'rgba(255,59,59,0.4)', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}
            >×</button>
          </div>
        ))
      )}
    </Widget>
  )
}
