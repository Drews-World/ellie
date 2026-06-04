import mascotStyles from './Mascot.module.css'

// ELLIE's face — the one sprite that stays. Central persona of the hub.
export default function Mascot({ size = 96, glow = true, style = {} }) {
  return (
    <div
      aria-label="ELLIE"
      className={mascotStyles.mascot}
      style={{ width: size, height: size, ...style }}
    >
      {glow && <span className={mascotStyles.halo} aria-hidden />}
      <img
        src="/sprites/EllieSprite/EllieHeadshot.png"
        alt="ELLIE"
        className={mascotStyles.face}
        draggable={false}
      />
    </div>
  )
}
