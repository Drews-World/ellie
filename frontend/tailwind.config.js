/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        hud: '#00d4ff',
        'hud-dim': 'rgba(0,212,255,0.15)',
        amber: '#ffb300',
        alert: '#ff3b3b',
        ok: '#00ff9d',
        bg: '#030c14',
        bg2: '#060f1a',
        bg3: '#091520',
      },
      fontFamily: {
        hud: ['Rajdhani', 'sans-serif'],
        mono: ['Share Tech Mono', 'monospace'],
        title: ['Orbitron', 'sans-serif'],
      },
      animation: {
        'pulse-ring': 'pulse-ring 3s ease-in-out infinite',
        'blink': 'blink 2s ease-in-out infinite',
        'scroll-ticker': 'scroll-ticker 40s linear infinite',
      }
    },
  },
  plugins: [],
}
