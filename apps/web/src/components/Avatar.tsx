import styles from './Avatar.module.css'

const TINTS = [styles.teal, styles.gold, styles.red, styles.blue]

export interface AvatarProps {
  name: string
  /** Seat number, which picks the colour. */
  seat: number
  /** It's this player's turn: gold rings ripple out from the avatar. */
  active?: boolean
}

/** A round badge with the player's initial. */
export function Avatar({ name, seat, active = false }: AvatarProps) {
  return (
    <span
      className={`${styles.avatar} ${TINTS[seat % TINTS.length]} ${active ? styles.active : ''}`}
      aria-hidden="true"
    >
      {active && (
        <>
          <span className={styles.ring} />
          <span className={`${styles.ring} ${styles.late}`} />
        </>
      )}
      <span className={styles.initial}>{name.trim().charAt(0).toUpperCase() || '?'}</span>
    </span>
  )
}
