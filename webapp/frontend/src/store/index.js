import { create } from 'zustand'
import soundEngine from '../lib/soundEngine'

export const useEllieStore = create((set, get) => ({
  // ── Auth ──
  user: null,
  session: null,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),

  // ── View mode ──
  activeView: 'world', // 'world' | 'personal'
  setActiveView: (view) => set({ activeView: view }),

  // ── Detail panel ──
  detailOpen: false,
  detailWidget: null,
  detailTitle: '',
  openDetail: (widget, title) => set({ detailOpen: true, detailWidget: widget, detailTitle: title }),
  closeDetail: () => set({ detailOpen: false, detailWidget: null }),

  // ── World data cache ──
  news: [],
  markets: {},
  crypto: [],
  weather: {},
  sports: [],
  threatMatrix: {},
  setNews: (news) => set({ news }),
  setMarkets: (markets) => set({ markets }),
  setCrypto: (crypto) => set({ crypto }),
  setWeather: (weather) => set({ weather }),
  setSports: (sports) => set({ sports }),
  setThreatMatrix: (threatMatrix) => set({ threatMatrix }),

  // ── Personal data ──
  calendarEvents: [],
  reminders: [],
  notes: [],
  goals: [],
  setCalendarEvents: (events) => set({ calendarEvents: events }),
  setReminders: (reminders) => set({ reminders }),
  setNotes: (notes) => set({ notes }),
  setGoals: (goals) => set({ goals }),

  // ── ELLIE memory (persisted in DB) ──
  ellieContext: {},
  setEllieContext: (ctx) => set({ ellieContext: ctx }),

  // ── ELLIE Chat ──
  chatMessages: [],          // { role, content, timestamp }
  chatOpen: false,           // response panel visible
  chatLoading: false,        // waiting for ELLIE
  addChatMessage: (msg) => set(s => ({
    chatMessages: [...s.chatMessages, { ...msg, timestamp: new Date() }].slice(-20),
  })),
  clearChat: () => set({ chatMessages: [], chatOpen: false }),
  setChatOpen: (v) => set({ chatOpen: v }),
  setChatLoading: (v) => set({ chatLoading: v }),

  // ── ELLIE Avatar ──
  ellieAvatarState: 'idle',   // 'idle' | 'thinking' | 'speaking' | 'alert' | 'listening'
  setEllieAvatarState: (state) => set({ ellieAvatarState: state }),

  // ── Globe → Satellite link ──
  globeFocusLocation: null,   // { lat, lng, name, zoom }
  setGlobeFocusLocation: (loc) => set({ globeFocusLocation: loc }),

  // ── Widget pulse (widgetKey → true for 2s) ──
  pulsingWidgets: {},
  pulseWidget: (widgetId) => {
    soundEngine.widgetPulse()
    set(s => ({ pulsingWidgets: { ...s.pulsingWidgets, [widgetId]: true } }))
    setTimeout(() => set(s => {
      const next = { ...s.pulsingWidgets }
      delete next[widgetId]
      return { pulsingWidgets: next }
    }), 2200)
  },
}))
