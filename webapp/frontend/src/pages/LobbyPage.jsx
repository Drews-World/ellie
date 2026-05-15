import { useUser } from '@clerk/clerk-react'
import Door from '../components/shared/Door'
import Mascot from '../components/shared/Mascot'

const DOORS = [
  {
    to: '/trading',
    label: 'Trading Floor',
    description: 'Live positions, fund controls, P&L, and daily trade recap.',
    icon: '📈',
    gradient: 'var(--grad-daylight)',
  },
  {
    to: '/business',
    label: 'Business Factory',
    description: 'Agent crew status, revenue tracking, and recent actions.',
    icon: '⚙️',
    gradient: 'var(--grad-violet)',
  },
  {
    to: '/og',
    label: 'OG Dashboard',
    description: 'World intel, personal mode, prayer, and IoT controls.',
    icon: '🌐',
    gradient: 'var(--grad-mint)',
  },
  {
    to: '/comms',
    label: 'Coming Soon',
    description: 'Comms Bay, Treasury, Media Bay, and more rooms are on the way.',
    icon: '🚧',
    gradient: 'var(--grad-sunrise)',
    disabled: true,
  },
]

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function LobbyPage() {
  const { user } = useUser()
  const firstName = user?.firstName || 'Drew'

  return (
    <div style={{
      minHeight: '100%',
      background: 'var(--grad-room-bg)',
      padding: '40px 32px',
    }}>
      {/* Greeting */}
      <div style={{ marginBottom: 40 }}>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 'var(--text-3xl)',
          color: 'var(--ink-900)',
          marginBottom: 8,
        }}>
          {getGreeting()}, {firstName}
        </h1>
        <p style={{
          color: 'var(--ink-500)',
          fontSize: 'var(--text-lg)',
        }}>
          The office is open. Where are we going today?
        </p>
      </div>

      {/* Door grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 24,
        marginBottom: 48,
      }}>
        {DOORS.map(door => (
          <Door key={door.to} {...door} />
        ))}
      </div>

      {/* Mascot + at-a-glance row */}
      <div style={{
        display: 'flex',
        gap: 24,
        alignItems: 'flex-start',
        flexWrap: 'wrap',
      }}>
        <div style={{
          flex: 1,
          minWidth: 280,
          background: 'var(--paper-50)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          boxShadow: 'var(--shadow-sm)',
          border: '1.5px solid var(--ink-300)',
        }}>
          <h3 style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 'var(--text-sm)',
            color: 'var(--ink-500)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 16,
          }}>
            Today at a glance
          </h3>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Trading', value: 'Connect your trading server to see live data', color: 'var(--amber-500)' },
              { label: 'Business', value: 'Business Factory stub running on :8001', color: 'var(--mint-500)' },
              { label: 'ELLIE', value: 'Online — Gemini 2.0 Flash', color: 'var(--violet-500)' },
            ].map(({ label, value, color }) => (
              <li key={label} style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                <span style={{
                  fontWeight: 700,
                  fontSize: 'var(--text-sm)',
                  color,
                  minWidth: 80,
                }}>
                  {label}
                </span>
                <span style={{ color: 'var(--ink-500)', fontSize: 'var(--text-sm)' }}>{value}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Mascot widget */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          padding: '24px',
          background: 'var(--paper-50)',
          borderRadius: 'var(--radius-lg)',
          border: '1.5px solid var(--ink-300)',
          boxShadow: 'var(--shadow-sm)',
          minWidth: 160,
        }}>
          <Mascot size={80} />
          <span style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--ink-500)',
            fontFamily: 'var(--font-pixel)',
            lineHeight: 1.6,
          }}>
            ELLIE HUB
          </span>
        </div>
      </div>
    </div>
  )
}
