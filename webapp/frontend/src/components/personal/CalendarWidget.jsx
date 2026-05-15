import { useState } from 'react'
import { useEllieStore } from '../../store'
import { createCalendarEvent, deleteCalendarEvent } from '../../lib/api'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, parseISO } from 'date-fns'
import Widget from '../shared/Widget'

export default function CalendarWidget() {
  const { calendarEvents, setCalendarEvents } = useEllieStore()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(new Date())
  const [showAddForm, setShowAddForm] = useState(false)
  const [newEvent, setNewEvent] = useState({ title: '', time: '', notes: '' })

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  })

  const eventsForDay = (day) =>
    calendarEvents.filter(e => isSameDay(parseISO(e.start_time), day))

  const eventsForSelected = eventsForDay(selectedDay)

  const handleAddEvent = async () => {
    if (!newEvent.title) return
    try {
      const startTime = new Date(selectedDay)
      if (newEvent.time) {
        const [h, m] = newEvent.time.split(':')
        startTime.setHours(+h, +m)
      }
      const res = await createCalendarEvent({
        title: newEvent.title,
        notes: newEvent.notes,
        start_time: startTime.toISOString(),
        end_time: new Date(startTime.getTime() + 60 * 60 * 1000).toISOString(),
      })
      setCalendarEvents([...calendarEvents, res.data])
      setNewEvent({ title: '', time: '', notes: '' })
      setShowAddForm(false)
    } catch (err) {
      console.error('Failed to create event:', err)
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteCalendarEvent(id)
      setCalendarEvents(calendarEvents.filter(e => e.id !== id))
    } catch (err) {
      console.error('Failed to delete event:', err)
    }
  }

  const mono = "'Share Tech Mono', monospace"
  const orb = "'Orbitron', sans-serif"

  return (
    <Widget title="CALENDAR" badge={format(currentMonth, 'MMM yyyy')} widgetKey="calendar" detailTitle="CALENDAR // ELLIE BRIEF">
      {/* Month nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <button onClick={() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() - 1))}
          style={{ background: 'none', border: 'none', color: '#00d4ff', cursor: 'pointer', fontSize: 14 }}>‹</button>
        <span style={{ fontFamily: orb, fontSize: 10, letterSpacing: 2, color: '#00d4ff' }}>
          {format(currentMonth, 'MMMM yyyy').toUpperCase()}
        </span>
        <button onClick={() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() + 1))}
          style={{ background: 'none', border: 'none', color: '#00d4ff', cursor: 'pointer', fontSize: 14 }}>›</button>
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontFamily: mono, fontSize: 9, color: 'rgba(180,220,255,0.4)', padding: '2px 0' }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 12 }}>
        {/* Offset for first day of month */}
        {Array(days[0].getDay()).fill(null).map((_, i) => <div key={`offset-${i}`} />)}
        {days.map(day => {
          const hasEvents = eventsForDay(day).length > 0
          const selected = isSameDay(day, selectedDay)
          const today = isToday(day)
          return (
            <div
              key={day.toISOString()}
              onClick={(e) => { e.stopPropagation(); setSelectedDay(day) }}
              style={{
                textAlign: 'center',
                padding: '4px 2px',
                borderRadius: 2,
                cursor: 'pointer',
                fontFamily: mono,
                fontSize: 11,
                background: selected ? 'rgba(0,212,255,0.2)' : today ? 'rgba(0,212,255,0.06)' : 'transparent',
                border: today ? '1px solid rgba(0,212,255,0.4)' : '1px solid transparent',
                color: selected ? '#00d4ff' : today ? '#cceeff' : 'rgba(180,220,255,0.6)',
                position: 'relative',
              }}
            >
              {format(day, 'd')}
              {hasEvents && (
                <div style={{
                  width: 3, height: 3, borderRadius: '50%',
                  background: '#ffb300',
                  position: 'absolute', bottom: 1, left: '50%', transform: 'translateX(-50%)',
                }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Selected day events */}
      <div style={{ borderTop: '1px solid rgba(0,212,255,0.1)', paddingTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontFamily: orb, fontSize: 8, letterSpacing: 2, color: 'rgba(180,220,255,0.5)' }}>
            {format(selectedDay, 'MMM d, yyyy').toUpperCase()}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); setShowAddForm(!showAddForm) }}
            style={{
              fontFamily: orb, fontSize: 8, letterSpacing: 1,
              background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)',
              color: '#00d4ff', padding: '3px 8px', borderRadius: 2, cursor: 'pointer',
            }}
          >
            + ADD
          </button>
        </div>

        {showAddForm && (
          <div onClick={e => e.stopPropagation()} style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input
              placeholder="Event title"
              value={newEvent.title}
              onChange={e => setNewEvent({...newEvent, title: e.target.value})}
              style={{
                background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.2)',
                color: '#cceeff', padding: '6px 8px', borderRadius: 2,
                fontFamily: "'Rajdhani', sans-serif", fontSize: 12, width: '100%',
              }}
            />
            <input
              type="time"
              value={newEvent.time}
              onChange={e => setNewEvent({...newEvent, time: e.target.value})}
              style={{
                background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.2)',
                color: '#cceeff', padding: '6px 8px', borderRadius: 2,
                fontFamily: mono, fontSize: 12, width: '100%',
              }}
            />
            <button
              onClick={handleAddEvent}
              style={{
                background: 'rgba(0,212,255,0.15)', border: '1px solid rgba(0,212,255,0.4)',
                color: '#00d4ff', fontFamily: orb, fontSize: 8, letterSpacing: 2,
                padding: '6px', borderRadius: 2, cursor: 'pointer',
              }}
            >
              CONFIRM
            </button>
          </div>
        )}

        {eventsForSelected.length === 0 ? (
          <div style={{ fontFamily: mono, fontSize: 10, color: 'rgba(180,220,255,0.3)', textAlign: 'center', padding: '8px 0' }}>
            NO EVENTS SCHEDULED
          </div>
        ) : (
          eventsForSelected.map(event => (
            <div key={event.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 8px',
              background: 'rgba(0,212,255,0.04)',
              border: '1px solid rgba(0,212,255,0.1)',
              borderRadius: 2,
              marginBottom: 4,
            }}>
              <div>
                <div style={{ fontSize: 12, color: '#cceeff' }}>{event.title}</div>
                {event.start_time && (
                  <div style={{ fontFamily: mono, fontSize: 9, color: 'rgba(180,220,255,0.4)', marginTop: 1 }}>
                    {format(parseISO(event.start_time), 'h:mm a')}
                  </div>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(event.id) }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,59,59,0.5)', cursor: 'pointer', fontSize: 12 }}
              >×</button>
            </div>
          ))
        )}
      </div>
    </Widget>
  )
}
