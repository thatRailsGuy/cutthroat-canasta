import type { PublicPlayer } from '@canasta/engine'
import { Avatar } from './Avatar'
import { CardBack } from './Card'
import { MeldList } from './MeldList'
import { RoundPoints } from './RoundPoints'
import { FrozenChip } from './Snowflake'
import styles from './Table.module.css'

export interface OpponentPanelProps {
  player: PublicPlayer
  isTurn: boolean
  isConnected: boolean
  isHost: boolean
  /** This player dealt the round. */
  isDealer?: boolean
  /** Seat number, which picks the avatar colour. */
  seat: number
  /** The round is in play. */
  playing: boolean
  /** A crowded table or a phone: a shorter panel, with meld chips instead of cards. */
  crowded?: boolean
  /** Overrides whether melds show as chips; by default they do on a crowded panel. */
  chips?: boolean
  /**
   * The pile is frozen for this player: a labelled chip on a roomy panel, a snowflake on the
   * avatar of a crowded one.
   */
  pileFrozen?: boolean
}

export function OpponentPanel(props: OpponentPanelProps) {
  const { player, isTurn, isConnected, isHost, seat, playing } = props
  const isDealer = props.isDealer ?? false
  const crowded = props.crowded ?? false
  const chips = props.chips ?? crowded
  const pileFrozen = props.pileFrozen ?? false
  return (
    <section
      className={`${styles.opponent} ${crowded ? styles.crowded : ''} ${isTurn ? styles.turn : ''}`}
      aria-label={`${player.name}${isTurn ? ', playing now' : ''}${isDealer ? ', dealer' : ''}${pileFrozen ? ', pile frozen' : ''}`}
      data-player-id={player.id}
    >
      <header>
        <Avatar
          name={player.name}
          seat={seat}
          active={isTurn}
          dealer={isDealer}
          frozen={pileFrozen && crowded}
        />
        <div className={styles.who}>
          <span className={styles.nameLine}>
            <strong>{player.name}</strong>
            <span
              className={isConnected ? styles.online : styles.offline}
              role="img"
              aria-label={isConnected ? 'Online' : 'Offline'}
              title={isConnected ? 'Online' : 'Offline'}
            />
            {isHost && <span className={styles.badge}>Host</span>}
            {pileFrozen && !crowded && <FrozenChip name={player.name} />}
          </span>
          <RoundPoints player={player} playing={playing} />
        </div>
        <span className={styles.handCount} data-hand-target="">
          <span className={styles.backs} aria-hidden="true">
            {Array.from({ length: Math.min(player.handCount, 5) }, (_, i) => (
              <CardBack key={i} size="tiny" />
            ))}
          </span>
          {player.handCount} cards
        </span>
      </header>
      <MeldList melds={player.melds} red3s={player.red3s} compact chips={chips} />
    </section>
  )
}
