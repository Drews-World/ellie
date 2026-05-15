export default function PixelLabel({ children, gradient = 'var(--grad-daylight)', style = {} }) {
  return (
    <span style={{
      background: gradient,
      color: 'var(--paper-50)',
      fontFamily: 'var(--font-pixel)',
      fontSize: '10px',
      padding: '6px 14px',
      borderRadius: 'var(--radius-md)',
      display: 'inline-block',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      lineHeight: 1.6,
      ...style,
    }}>
      {children}
    </span>
  )
}
