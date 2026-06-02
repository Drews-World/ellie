import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
})

// Attach Clerk token to every request.
// Kept as a fallback for the brief window before Clerk's global is ready.
export const setAuthToken = (token) => {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`
}

// Source of truth: fetch a FRESH Clerk token per request. The global default
// header above goes stale — Clerk session tokens expire after 60s and a timer
// refresh can fire late (background-tab throttling) or not at all before the
// first request, yielding spurious 401s. Clerk caches the token internally and
// only re-mints it near expiry, so this is cheap and always current.
api.interceptors.request.use(async (config) => {
  try {
    const token = await window.Clerk?.session?.getToken()
    if (token) config.headers.Authorization = `Bearer ${token}`
  } catch {
    // Clerk not ready — fall back to the default header set by setAuthToken
  }
  return config
})

// World data endpoints
export const worldApi = {
  getNews: (category = 'general') => api.get('/news', { params: { category } }),
  getStocks: () => api.get('/markets'),
  getCrypto: () => api.get('/markets/crypto'),
  getWeather: (cities) => api.get('/weather', { params: { cities } }),
  getSports: (leagues = 'nba,nfl,mlb') => api.get('/sports', { params: { leagues } }),
  getThreatMatrix: () => api.get('/threat-matrix'),
  getFlights: (params) => api.get('/flights', { params }),
  getDispatch: (limit = 40) => api.get('/dispatch', { params: { limit } }),
  getZoneIntel: (zone) => api.get('/zone-intel', {
    params: {
      zone_id:   zone.id,
      zone_name: zone.name,
      keywords:  zone.keywords.join(','),
    },
  }),
}

// Personal data endpoints
export const personalApi = {
  getEvents: () => api.get('/calendar/events'),
  createEvent: (data) => api.post('/calendar/events', data),
  updateEvent: (id, data) => api.put(`/calendar/events/${id}`, data),
  deleteEvent: (id) => api.delete(`/calendar/events/${id}`),

  getReminders: () => api.get('/reminders'),
  createReminder: (data) => api.post('/reminders', data),
  updateReminder: (id, data) => api.put(`/reminders/${id}`, data),
  deleteReminder: (id) => api.delete(`/reminders/${id}`),

  getGoals: () => api.get('/goals'),
  createGoal: (data) => api.post('/goals', data),
  updateGoal: (id, data) => api.put(`/goals/${id}`, data),

  getNotes: () => api.get('/notes'),
  createNote: (data) => api.post('/notes', data),
  updateNote: (id, data) => api.put(`/notes/${id}`, data),
  deleteNote: (id) => api.delete(`/notes/${id}`),
}

// ELLIE AI brief
export const ellieApi = {
  getBrief: (widget, context = {}) =>
    api.post('/ellie/brief', { widget, context }),
  chat: (messages, context = {}) =>
    api.post('/ellie/chat', { messages, context }),
}

// Named exports for components that import these directly
export const createCalendarEvent = (data) => api.post('/calendar/events', data)
export const deleteCalendarEvent = (id) => api.delete(`/calendar/events/${id}`)

export const createReminder = (data) => api.post('/reminders', data)
export const updateReminder = (id, data) => api.put(`/reminders/${id}`, data)
export const deleteReminder = (id) => api.delete(`/reminders/${id}`)

// ellieQuery — used by DetailPanel to fetch an ELLIE brief for a widget
export const ellieQuery = (widget, context = {}) =>
  api.post('/ellie/brief', { widget, context })

// IoT / Govee lighting
export const iotApi = {
  getDevices:    ()       => api.get('/iot/devices'),
  triggerScene:  (scene)  => api.post('/iot/lights/scene', { scene }),
  rawControl:    (payload)=> api.post('/iot/lights/raw', payload),
  getConfig:     ()       => api.get('/iot/lights/config'),
  saveConfig:    (config) => api.put('/iot/lights/config', config),
}

// Prayer board
export const prayerApi = {
  list:   ()          => api.get('/prayer'),
  create: (data)      => api.post('/prayer', data),
  update: (id, data)  => api.put(`/prayer/${id}`, data),
  remove: (id)        => api.delete(`/prayer/${id}`),
}

export default api
