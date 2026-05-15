import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useEllieStore } from '../store'
import { getCalendarEvents, getReminders, getNotes, getGoals } from '../lib/api'
import CalendarWidget from '../components/personal/CalendarWidget'
import RemindersWidget from '../components/personal/RemindersWidget'
import GoalsWidget from '../components/personal/GoalsWidget'
import NotesWidget from '../components/personal/NotesWidget'
import ElliePersonalBrief from '../components/personal/ElliePersonalBrief'
import QuickActionsWidget from '../components/personal/QuickActionsWidget'

export default function PersonalView() {
  const { setCalendarEvents, setReminders, setNotes, setGoals } = useEllieStore()

  useEffect(() => {
    const fetchPersonal = async () => {
      try {
        const now = new Date()
        const start = now.toISOString()
        const end = new Date(now.setDate(now.getDate() + 30)).toISOString()

        const [events, reminders, notes, goals] = await Promise.allSettled([
          getCalendarEvents(start, end),
          getReminders(),
          getNotes(),
          getGoals(),
        ])

        if (events.status === 'fulfilled') setCalendarEvents(events.value.data)
        if (reminders.status === 'fulfilled') setReminders(reminders.value.data)
        if (notes.status === 'fulfilled') setNotes(notes.value.data)
        if (goals.status === 'fulfilled') setGoals(goals.value.data)
      } catch (err) {
        console.error('Personal data fetch error:', err)
      }
    }

    fetchPersonal()
  }, [])

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 340px',
      gap: 10,
      padding: 10,
      minHeight: 'calc(100vh - 90px)',
    }}>
      {/* MAIN — Calendar takes center stage */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <ElliePersonalBrief />
        <CalendarWidget />
        <GoalsWidget />
      </div>

      {/* SIDEBAR */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <QuickActionsWidget />
        <RemindersWidget />
        <NotesWidget />
      </div>
    </div>
  )
}
