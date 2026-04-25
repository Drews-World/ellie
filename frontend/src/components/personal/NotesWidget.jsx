import { useState, useEffect } from 'react'
import { useEllieStore } from '../../store'
import { personalApi } from '../../lib/api'
import Widget from '../shared/Widget'

const mono = "'Share Tech Mono', monospace"
const orb  = "'Orbitron', sans-serif"

export default function NotesWidget() {
  const { notes, setNotes } = useEllieStore()
  const [showAdd, setShowAdd] = useState(false)
  const [newNote, setNewNote] = useState({ title: '', content: '' })
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    if (notes.length) return
    personalApi.getNotes().then(r => setNotes(r.data || [])).catch(() => {})
  }, [])

  const handleAdd = async () => {
    if (!newNote.title) return
    try {
      const res = await personalApi.createNote(newNote)
      setNotes([res.data, ...notes])
      setNewNote({ title: '', content: '' })
      setShowAdd(false)
    } catch (err) { console.error(err) }
  }

  const handleDelete = async (id) => {
    try {
      await personalApi.deleteNote(id)
      setNotes(notes.filter(n => n.id !== id))
    } catch (err) { console.error(err) }
  }

  const pinned = notes.filter(n => n.pinned)
  const unpinned = notes.filter(n => !n.pinned)
  const sorted = [...pinned, ...unpinned]

  return (
    <Widget title="NOTES" badge={`${notes.length} FILES`} widgetKey="notes" detailTitle="NOTES // ELLIE BRIEF">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button
          onClick={(e) => { e.stopPropagation(); setShowAdd(!showAdd) }}
          style={{
            fontFamily: orb, fontSize: 8, letterSpacing: 1,
            background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)',
            color: '#00d4ff', padding: '3px 8px', borderRadius: 2, cursor: 'pointer',
          }}
        >+ NEW</button>
      </div>

      {showAdd && (
        <div onClick={e => e.stopPropagation()} style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            placeholder="Note title..."
            value={newNote.title}
            onChange={e => setNewNote({ ...newNote, title: e.target.value })}
            style={{
              background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.2)',
              color: '#cceeff', padding: '6px 8px', borderRadius: 2,
              fontFamily: "'Rajdhani', sans-serif", fontSize: 12, width: '100%',
            }}
          />
          <textarea
            placeholder="Content..."
            value={newNote.content}
            onChange={e => setNewNote({ ...newNote, content: e.target.value })}
            rows={3}
            style={{
              background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.2)',
              color: '#cceeff', padding: '6px 8px', borderRadius: 2, resize: 'vertical',
              fontFamily: "'Rajdhani', sans-serif", fontSize: 12, width: '100%',
            }}
          />
          <button
            onClick={handleAdd}
            style={{
              background: 'rgba(0,212,255,0.15)', border: '1px solid rgba(0,212,255,0.4)',
              color: '#00d4ff', fontFamily: orb, fontSize: 8, letterSpacing: 2,
              padding: '6px', borderRadius: 2, cursor: 'pointer',
            }}
          >SAVE</button>
        </div>
      )}

      {sorted.length === 0 && (
        <div style={{ fontFamily: mono, fontSize: 10, color: 'rgba(180,220,255,0.3)', textAlign: 'center', padding: '8px 0' }}>
          NO NOTES ON FILE
        </div>
      )}

      {sorted.slice(0, 6).map(note => (
        <div key={note.id} style={{
          padding: '7px 0',
          borderBottom: '1px solid rgba(0,212,255,0.06)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div
              onClick={(e) => { e.stopPropagation(); setExpanded(expanded === note.id ? null : note.id) }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', flex: 1 }}
            >
              {note.pinned && <span style={{ color: '#ffb300', fontSize: 10 }}>★</span>}
              <span style={{ fontSize: 12, color: '#cceeff' }}>{note.title}</span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(note.id) }}
              style={{ background: 'none', border: 'none', color: 'rgba(255,59,59,0.4)', cursor: 'pointer', fontSize: 12 }}
            >×</button>
          </div>
          {expanded === note.id && note.content && (
            <div style={{
              fontFamily: mono, fontSize: 10, color: 'rgba(180,220,255,0.6)',
              marginTop: 6, lineHeight: 1.6, whiteSpace: 'pre-wrap',
            }}>
              {note.content}
            </div>
          )}
          <div style={{ fontFamily: mono, fontSize: 8, color: 'rgba(180,220,255,0.25)', marginTop: 2 }}>
            {note.updated_at ? new Date(note.updated_at).toLocaleDateString() : ''}
          </div>
        </div>
      ))}
    </Widget>
  )
}
