import { useState } from 'react'
import { useEllieStore } from '../../store'
import { createReminder, updateReminder, deleteReminder } from '../../lib/api'
import Widget from '../shared/Widget'

const PRIORITIES = { high: '#ff3b3b', medium: '#ffb300', low: '#5FD0D8' }

export default function RemindersWidget() {
  const { reminders, setReminders } = useEllieStore()
  const [showAdd, setShowAdd] = useState(false)
  const [newItem, setNewItem] = useState({ title: '', due_date: '', priority: 'medium' })

  const pending = reminders.filter(r => !r.completed)
  const done = reminders.filter(r => r.completed)

  const handleAdd = async () => {
    if (!newItem.title) return
    try {
      const res = await createReminder(newItem)
      setReminders([...reminders, res.data])
      setNewItem({ title: '', due_date: '', priority: 'medium' })
      setShowAdd(false)
    } catch (err) { console.error(err) }
  }

  const handleToggle = async (r) => {
    try {
      const res = await updateReminder(r.id, { completed: !r.completed })
      setReminders(reminders.map(x => x.id === r.id ? res.data : x))
    } catch (err) { console.error(err) }
  }

  const handleDelete = async (id) => {
    try {
      await deleteReminder(id)
      setReminders(reminders.filter(r => r.id !== id))
    } catch (err) { console.error(err) }
  }

  const mono = "'Share Tech Mono', monospace"
  const orb = "'Orbitron', sans-serif"

  return (
    <Widget title="REMINDERS" badge={`${pending.length} PENDING`} badgeType={pending.length > 0 ? 'amber' : 'green'} widgetKey="reminders">
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
            placeholder="Reminder..."
            value={newItem.title}
            onChange={e => setNewItem({...newItem, title: e.target.value})}
            style={{
              background: 'rgba(95,208,216,0.05)', border: '1px solid rgba(95,208,216,0.2)',
              color: '#cceeff', padding: '6px 8px', borderRadius: 2,
              fontFamily: "'Rajdhani', sans-serif", fontSize: 12, width: '100%',
            }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="date"
              value={newItem.due_date}
              onChange={e => setNewItem({...newItem, due_date: e.target.value})}
              style={{
                flex: 1, background: 'rgba(95,208,216,0.05)', border: '1px solid rgba(95,208,216,0.2)',
                color: '#cceeff', padding: '6px 8px', borderRadius: 2,
                fontFamily: mono, fontSize: 11,
              }}
            />
            <select
              value={newItem.priority}
              onChange={e => setNewItem({...newItem, priority: e.target.value})}
              style={{
                background: 'rgba(95,208,216,0.05)', border: '1px solid rgba(95,208,216,0.2)',
                color: '#cceeff', padding: '6px 8px', borderRadius: 2,
                fontFamily: mono, fontSize: 10,
              }}
            >
              <option value="high">HIGH</option>
              <option value="medium">MED</option>
              <option value="low">LOW</option>
            </select>
          </div>
          <button
            onClick={handleAdd}
            style={{
              background: 'rgba(95,208,216,0.15)', border: '1px solid rgba(95,208,216,0.4)',
              color: '#5FD0D8', fontFamily: orb, fontSize: 8, letterSpacing: 2,
              padding: '6px', borderRadius: 2, cursor: 'pointer',
            }}
          >CONFIRM</button>
        </div>
      )}

      {pending.map(r => (
        <div key={r.id} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 0', borderBottom: '1px solid rgba(95,208,216,0.06)',
        }}>
          <div
            onClick={(e) => { e.stopPropagation(); handleToggle(r) }}
            style={{
              width: 14, height: 14, borderRadius: 2,
              border: `1px solid ${PRIORITIES[r.priority] || '#5FD0D8'}`,
              cursor: 'pointer', flexShrink: 0,
              background: r.completed ? PRIORITIES[r.priority] : 'transparent',
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: '#cceeff' }}>{r.title}</div>
            {r.due_date && (
              <div style={{ fontFamily: mono, fontSize: 9, color: 'rgba(180,220,255,0.4)' }}>
                DUE {new Date(r.due_date).toLocaleDateString()}
              </div>
            )}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(r.id) }}
            style={{ background: 'none', border: 'none', color: 'rgba(255,59,59,0.4)', cursor: 'pointer', fontSize: 12 }}
          >×</button>
        </div>
      ))}

      {pending.length === 0 && (
        <div style={{ fontFamily: mono, fontSize: 10, color: 'rgba(180,220,255,0.3)', textAlign: 'center', padding: '8px 0' }}>
          ALL CLEAR, DREW
        </div>
      )}
    </Widget>
  )
}
