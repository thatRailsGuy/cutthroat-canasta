import type { PublicPlayer } from '@canasta/engine'
import { MeldList } from './MeldList'
import styles from './Table.module.css'

export interface OpponentPanelProps {
  player: PublicPlayer
  isTurn: boolean
  isConnected: boolean
  isHost: boolean
  /** Host only, for a disconnected player: ask the server for a rejoin link. */
  onReissue?: () => void
  rejoinLink?: string
}

export function OpponentPanel(props: OpponentPanelProps) {
  const { player, isTurn, isConnected, isHost, onReissue, rejoinLink } = props
  return (
    <section
      className={`${styles.opponent} ${isTurn ? styles.turn : ''}`}
      aria-label={`${player.name}${isTurn ? ', playing now' : ''}`}
    >
      <header>
        <span
          className={isConnected ? styles.online : styles.offline}
          title={isConnected ? 'Connected' : 'Not connected'}
        />
        <strong>{player.name}</strong>
        {isHost && <span className={styles.badge}>Host</span>}
        <span>{player.handCount} cards</span>
        <span>{player.score.toLocaleString('en-US')} pts</span>
      </header>
      <MeldList melds={player.melds} red3s={player.red3s} />
      {onReissue && !isConnected && <RejoinControl onReissue={onReissue} link={rejoinLink} />}
    </section>
  )
}

export function RejoinControl({ onReissue, link }: { onReissue: () => void; link?: string }) {
  if (!link) {
    return (
      <button type="button" onClick={onReissue}>
        Make rejoin link
      </button>
    )
  }
  return (
    <div className={styles.rejoin}>
      <input
        readOnly
        value={link}
        aria-label="Rejoin link"
        onFocus={(e) => e.currentTarget.select()}
      />
      <button type="button" onClick={() => void navigator.clipboard?.writeText(link)}>
        Copy
      </button>
    </div>
  )
}
