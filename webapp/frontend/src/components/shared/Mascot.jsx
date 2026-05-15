import mascotStyles from './Mascot.module.css'

export default function Mascot({ size = 96, style = {} }) {
  return (
    <div
      aria-label="ELLIE mascot"
      className={mascotStyles.mascot}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.48),
        ...style,
      }}
    >
      🐣
    </div>
  )
}
