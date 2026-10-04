import styles from './Avatar.module.css'

/** One colour per seat, so no two players at a table of up to eight share one. */
const TINTS = [
  styles.teal,
  styles.gold,
  styles.red,
  styles.blue,
  styles.plum,
  styles.avocado,
  styles.pink,
  styles.walnut,
]

export interface AvatarProps {
  name: string
  /** Seat number, which picks the colour. */
  seat: number
  /** It's this player's turn: gold rings ripple out from the avatar. */
  active?: boolean
  /** A smaller badge, for the turn order strip. */
  small?: boolean
  /** This player dealt the round: a "D" chip sits on the badge. */
  dealer?: boolean
}

/** A round badge with the player's initial. */
export function Avatar({ name, seat, active = false, small = false, dealer = false }: AvatarProps) {
  return (
    <span
      className={`${styles.avatar} ${TINTS[seat % TINTS.length]} ${active ? styles.active : ''} ${small ? styles.small : ''}`}
      aria-hidden="true"
    >
      {active && (
        <>
          <span className={styles.ring} />
          <span className={`${styles.ring} ${styles.late}`} />
        </>
      )}
      <span className={styles.initial}>{name.trim().charAt(0).toUpperCase() || '?'}</span>
      {dealer && (
        <span className={styles.dealer} title="Dealer">
          D
        </span>
      )}
    </span>
  )
}
