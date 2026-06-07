import { useState, useEffect } from 'react'
import { useEllieStore } from '../../store'
import { personalApi } from '../../lib/api'
import Widget from '../shared/Widget'

const mono = "'Share Tech Mono', monospace"
const orb  = "'Orbitron', sans-serif"

export default function GoalsWidget() {
  const { goals, setGoals } = useEllieStore()
  const [showAdd, setShowAdd] = useState(false)
  const [newGoal, setNewGoal] = useState({ title: '', target_date: '', category: 'personal' })

  useEffect(() => {
    if (goals.length) return
    personalApi.getGoals().then(r => setGoals(r.data || [])).catch(() => {})
  }, [])

  const handleAdd = async () => {
    if (!newGoal.title) return
    try {
      const res = await personalApi.createGoal({ ...newGoal, milestones: [] })
      setGoals([...goals, res.data])
      setNewGoal({ title: '', target_date: '', category: 'personal' })
      setShowAdd(false)
    } catch (err) { console.error(err) }
  }

  const handleComplete = async (g) => {
    try {
      const res = await personalApi.updateGoal(g.id, { completed: true })
      setGoals(goals.map(x => x.id === g.id ? res.data : x))
    } catch (err) { console.error(err) }
  }

  const active = goals.filter(g => !g.completed)

  return (
    <Widget title="OBJECTIVES" badge={`${active.length} ACTIVE`} badgeType={active.length > 0 ? 'default' : 'green'} widgetKey="goals" detailTitle="GOALS // ELLIE BRIEF">
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
            placeholder="Goal title..."
            value={newGoal.title}
            onChange={e => setNewGoal({ ...newGoal, title: e.target.value })}
            style={{
              background: 'rgba(95,208,216,0.05)', border: '1px solid rgba(95,208,216,0.2)',
              color: '#cceeff', padding: '6px 8px', borderRadius: 2,
              fontFamily: "'Rajdhani', sans-serif", fontSize: 12, width: '100%',
            }}
          />
          <input
            type="date"
            value={newGoal.target_date}
            onChange={e => setNewGoal({ ...newGoal, target_date: e.target.value })}
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
          >CONFIRM</button>
        </div>
      )}

      {active.length === 0 && (
        <div style={{ fontFamily: mono, fontSize: 10, color: 'rgba(180,220,255,0.3)', textAlign: 'center', padding: '8px 0' }}>
          NO ACTIVE OBJECTIVES
        </div>
      )}

      {active.map(g => (
        <div key={g.id} style={{
          display: 'flex', alignItems: 'flex-start', gap: 8,
          padding: '7px 0', borderBottom: '1px solid rgba(95,208,216,0.06)',
        }}>
          <div
            onClick={(e) => { e.stopPropagation(); handleComplete(g) }}
            style={{
              width: 14, height: 14, borderRadius: 2, marginTop: 2,
              border: '1px solid rgba(95,208,216,0.4)',
              cursor: 'pointer', flexShrink: 0,
              background: 'transparent',
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: '#cceeff' }}>{g.title}</div>
            {g.target_date && (
              <div style={{ fontFamily: mono, fontSize: 9, color: 'rgba(180,220,255,0.4)', marginTop: 2 }}>
                TARGET {new Date(g.target_date).toLocaleDateString()}
              </div>
            )}
            {g.milestones?.length > 0 && (
              <div style={{ fontFamily: mono, fontSize: 9, color: 'rgba(95,208,216,0.5)', marginTop: 2 }}>
                {g.milestones.filter(m => m.done).length}/{g.milestones.length} MILESTONES
              </div>
            )}
          </div>
        </div>
      ))}
    </Widget>
  )
}
