import { create } from 'zustand'

export const usePersonalStore = create((set) => ({
  events: [],
  reminders: [],
  goals: [],
  notes: [],
  setEvents: (events) => set({ events }),
  setReminders: (reminders) => set({ reminders }),
  setGoals: (goals) => set({ goals }),
  setNotes: (notes) => set({ notes }),
  addReminder: (reminder) => set(s => ({ reminders: [...s.reminders, reminder] })),
  toggleReminder: (id) => set(s => ({
    reminders: s.reminders.map(r => r.id === id ? { ...r, done: !r.done } : r)
  })),
  deleteReminder: (id) => set(s => ({ reminders: s.reminders.filter(r => r.id !== id) })),
}))
