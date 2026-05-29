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
  sceneSrc = null, // optional pixel art background image
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
          e.currentTarget.style.transform = 'translateY(-3px)'
          e.currentTarget.style.boxShadow = 'var(--shadow-pop)'
          e.currentTarget.style.borderColor = 'rgba(255,220,0,0.38)'
          e.currentTarget.querySelector('.door-wash').style.opacity = '0.10'
        }
      }}
      onMouseLeave={e => {
        if (!disabled) {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = 'var(--shadow-md)'
          e.currentTarget.style.borderColor = 'var(--ink-300)'
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
      {/* Pixel art scene background — when provided, fills the card */}
      {sceneSrc ? (
        <>
          <img
            src={sceneSrc}
            alt=""
            draggable={false}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'cover',
              imageRendering: 'pixelated',
              zIndex: 0,
              pointerEvents: 'none',
            }}
          />
          {/* Bottom gradient keeps label/description readable */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: '65%',
            background: 'linear-gradient(0deg, rgba(4,5,12,0.97) 40%, rgba(4,5,12,0) 100%)',
            zIndex: 1,
            pointerEvents: 'none',
          }} />
          {/* Top edge gradient for brand tint */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            height: '30%',
            background: `linear-gradient(180deg, ${gradient.includes('var') ? 'rgba(40,20,80,0.45)' : 'rgba(0,0,0,0.35)'} 0%, transparent 100%)`,
            zIndex: 1,
            pointerEvents: 'none',
          }} />
        </>
      ) : (
        /* Gradient hover wash — only shown when no scene */
        <div
          className="door-wash"
          style={{
            position: 'absolute', inset: 0,
            background: gradient,
            opacity: 0,
            transition: 'opacity 0.3s',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      )}

      {/* Icon area — small badge top-right when scene present, large centered otherwise */}
      {sceneSrc ? (
        <div style={{
          position: 'relative',
          zIndex: 2,
          alignSelf: 'flex-end',
          width: 44, height: 44,
          borderRadius: 8,
          background: gradient,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
          boxShadow: '0 2px 12px rgba(0,0,0,0.7)',
          margin: '12px 12px 0 0',
          flexShrink: 0,
        }}>
          {icon}
        </div>
      ) : (
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
      )}

      {/* Spacer — pushes label/desc to bottom when scene is present */}
      {sceneSrc && <div style={{ flex: 1 }} />}

      {/* Label strip */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        <PixelLabel gradient={gradient}>{label}</PixelLabel>
      </div>

      {/* Description */}
      <p style={{
        position: 'relative',
        zIndex: 2,
        color: sceneSrc ? 'rgba(255,255,255,0.55)' : 'var(--ink-500)',
        fontSize: 'var(--text-sm)',
        lineHeight: 1.6,
        margin: 0,
        flex: sceneSrc ? 0 : 1,
      }}>
        {description}
      </p>

      {/* Status row */}
      <div style={{
        position: 'relative',
        zIndex: 2,
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
