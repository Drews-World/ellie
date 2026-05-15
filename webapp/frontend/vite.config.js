import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const BACKEND = 'http://localhost:8002'

// All routes served by the Hub backend — proxied so the browser sees same-origin
// requests and never needs a CORS preflight.
const API_PREFIXES = [
  '/business', '/calendar', '/reminders', '/goals', '/notes',
  '/ellie', '/weather', '/markets', '/news', '/prayer',
  '/iot', '/trading', '/health', '/sports', '/dispatch',
  '/zone-intel', '/threat-matrix', '/flights',
]

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: Object.fromEntries(
      API_PREFIXES.map(p => [p, { target: BACKEND, changeOrigin: true }])
    ),
  },
})
