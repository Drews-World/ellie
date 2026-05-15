import { useNavigate } from 'react-router-dom'
import PixelLabel from './PixelLabel'

export default function Door({
  to,
  label,
  description,
  icon,
  gradient = 'var(--grad-daylight)',
  disabled = false,
  statusDots = 0,
  alerts = 0,
}) {
  const navigate = useNavigate()

  const handleClick = () => {
    if (!disabled) navigate(to)
  }

  const handleKeyDown = (e) => {
    if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      navigate(to)
    }
  }

  return (
    <button
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      aria-label={`Open ${label}`}
      style={{
        width: '100%',
        background: disabled ? 'var(--paper-50)' : 'var(--paper-50)',
        border: '1.5px solid var(--ink-300)',
        borderRadius: 'var(--radius-xl)',
        padding: '24px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        textAlign: 'left',
        transition: 'transform 0.2s ease-out, box-shadow 0.2s ease-out, border-color 0.2s',
        boxShadow: 'var(--shadow-md)',
        opacity: disabled ? 0.5 : 1,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        minHeight: '280px',
      }}
      onMouseEnter={e => {
        if (!disabled) {
          e.currentTarget.style.transform = 'translateY(-4px)'
          e.currentTarget.style.boxShadow = 'var(--shadow-pop)'
          e.currentTarget.style.borderColor = 'var(--ink-300)'
          e.currentTarget.querySelector('.door-wash').style.opacity = '0.06'
        }
      }}
      onMouseLeave={e => {
        if (!disabled) {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = 'var(--shadow-md)'
          e.currentTarget.querySelector('.door-wash').style.opacity = '0'
        }
      }}
      onMouseDown={e => {
        if (!disabled) e.currentTarget.style.transform = 'scale(0.97)'
      }}
      onMouseUp={e => {
        if (!disabled) e.currentTarget.style.transform = 'translateY(-4px)'
      }}
    >
      {/* Gradient hover wash */}
      <div
        className="door-wash"
        style={{
          position: 'absolute',
          inset: 0,
          background: gradient,
          opacity: 0,
          transition: 'opacity 0.3s',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Icon area */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        width: 128,
        height: 128,
        borderRadius: 'var(--radius-lg)',
        background: gradient,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 52,
        boxShadow: 'var(--shadow-md)',
        alignSelf: 'center',
      }}>
        {icon}
      </div>

      {/* Label strip */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <PixelLabel gradient={gradient}>{label}</PixelLabel>
      </div>

      {/* Description */}
      <p style={{
        position: 'relative',
        zIndex: 1,
        color: 'var(--ink-500)',
        fontSize: 'var(--text-sm)',
        lineHeight: 1.6,
        margin: 0,
        flex: 1,
      }}>
        {description}
      </p>

      {/* Status row */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {alerts > 0 ? (
          <span style={{
            color: 'var(--coral-500)',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            fontFamily: 'var(--font-ui)',
          }}>
            ● {alerts} alert{alerts !== 1 ? 's' : ''}
          </span>
        ) : (
          <span style={{
            color: 'var(--mint-500)',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
          }}>
            ● Online
          </span>
        )}
        {!disabled && (
          <span style={{ color: 'var(--ink-300)', fontSize: 20 }}>›</span>
        )}
      </div>
    </button>
  )
}
