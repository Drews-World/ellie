import { signInWithGoogle } from '../lib/supabase'

export default function Login() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#030c14',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: '32px',
      fontFamily: "'Rajdhani', sans-serif",
    }}>
      {/* Logo */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 72, height: 72,
          border: '2px solid #00d4ff',
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
          fontSize: 28,
          color: '#00d4ff',
          fontFamily: "'Orbitron', sans-serif",
          fontWeight: 900,
          animation: 'pulse-ring 3s ease-in-out infinite',
        }}>E</div>
        <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 24, letterSpacing: 8, color: '#00d4ff', fontWeight: 900 }}>
          ELLIE
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: 'rgba(180,220,255,0.5)', letterSpacing: 3, marginTop: 6 }}>
          EXECUTIVE LIFE LOGIC INTELLIGENCE ENGINE
        </div>
      </div>

      {/* Auth card */}
      <div style={{
        background: '#060f1a',
        border: '1px solid rgba(0,212,255,0.25)',
        borderRadius: 4,
        padding: '32px 40px',
        textAlign: 'center',
        minWidth: 320,
      }}>
        <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 10, letterSpacing: 3, color: 'rgba(180,220,255,0.5)', marginBottom: 24 }}>
          IDENTITY VERIFICATION
        </div>

        <button
          onClick={signInWithGoogle}
          style={{
            background: 'rgba(0,212,255,0.08)',
            border: '1px solid rgba(0,212,255,0.4)',
            color: '#00d4ff',
            fontFamily: "'Orbitron', sans-serif",
            fontSize: 11,
            letterSpacing: 3,
            padding: '12px 32px',
            borderRadius: 2,
            cursor: 'pointer',
            width: '100%',
            transition: 'all 0.2s',
          }}
          onMouseOver={e => e.target.style.background = 'rgba(0,212,255,0.18)'}
          onMouseOut={e => e.target.style.background = 'rgba(0,212,255,0.08)'}
        >
          SIGN IN WITH GOOGLE
        </button>

        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: 'rgba(180,220,255,0.3)', marginTop: 16 }}>
          AJH AUTHORIZED PERSONNEL ONLY
        </div>
      </div>
    </div>
  )
}
