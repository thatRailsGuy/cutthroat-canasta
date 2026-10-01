import type { PublicPlayer } from '@canasta/engine'
import { useRef, useState } from 'react'
import { Avatar } from './Avatar'
import { CardBack } from './Card'
import { MeldList } from './MeldList'
import { RoundPoints } from './RoundPoints'
import styles from './Table.module.css'

export interface OpponentPanelProps {
  player: PublicPlayer
  isTurn: boolean
  isConnected: boolean
  isHost: boolean
  /** Seat number, which picks the avatar colour. */
  seat: number
  /** The round is in play. */
  playing: boolean
  /**
   * Host only: ask the server for a rejoin link. Offered for every opponent, because a dead
   * phone can still count as connected: the server only notices a silent socket when a message
   * arrives, and the reissue request itself is that message.
   */
  onReissue?: () => void
  rejoinLink?: string
  /** A crowded table: a shorter panel, with meld chips instead of cards. */
  crowded?: boolean
}

export function OpponentPanel(props: OpponentPanelProps) {
  const { player, isTurn, isConnected, isHost, seat, playing, onReissue, rejoinLink } = props
  const crowded = props.crowded ?? false
  return (
    <section
      className={`${styles.opponent} ${crowded ? styles.crowded : ''} ${isTurn ? styles.turn : ''}`}
      aria-label={`${player.name}${isTurn ? ', playing now' : ''}`}
      data-player-id={player.id}
    >
      <header>
        <Avatar name={player.name} seat={seat} active={isTurn} />
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
          </span>
          <span className={styles.score}>{player.score.toLocaleString('en-US')} pts</span>
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
      <MeldList melds={player.melds} red3s={player.red3s} compact chips={crowded} />
      {onReissue && (
        // A new link remounts the control, which clears the last copy result.
        <RejoinControl
          key={rejoinLink}
          onReissue={onReissue}
          link={rejoinLink}
          subtle={isConnected}
          small={crowded}
        />
      )}
    </section>
  )
}

export interface RejoinControlProps {
  onReissue: () => void
  link?: string
  /**
   * The player still counts as connected: offer a small "Seat stuck?" button. If they really
   * are live, the server refuses with PLAYER_CONNECTED, which shows as a toast.
   */
  subtle?: boolean
  /** A crowded table: the small button even for a player who is offline. */
  small?: boolean
}

export function RejoinControl({
  onReissue,
  link,
  subtle = false,
  small = false,
}: RejoinControlProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [copyResult, setCopyResult] = useState<'copied' | 'manual' | null>(null)
  if (!link) {
    return subtle || small ? (
      <button type="button" className={styles.stuck} onClick={onReissue}>
        {small ? (subtle ? 'Stuck? Rejoin link' : 'Rejoin link') : 'Seat stuck? Make rejoin link'}
      </button>
    ) : (
      <button type="button" onClick={onReissue}>
        Make rejoin link
      </button>
    )
  }
  /**
   * The Clipboard API exists only in secure contexts, so it is missing over plain http on a LAN.
   * Then the link is selected for the host to copy by hand.
   */
  const copy = () => {
    const manual = () => {
      setCopyResult('manual')
      inputRef.current?.select()
    }
    if (!navigator.clipboard) return manual()
    navigator.clipboard
      .writeText(link)
      .then(() => setCopyResult('copied'))
      .catch(manual)
  }
  return (
    <div className={styles.rejoin}>
      <input
        ref={inputRef}
        readOnly
        value={link}
        aria-label="Rejoin link"
        onFocus={(e) => e.currentTarget.select()}
      />
      <button type="button" onClick={copy}>
        Copy
      </button>
      <span role="status">
        {copyResult === 'copied' ? 'Copied' : copyResult === 'manual' ? 'Select and copy' : ''}
      </span>
    </div>
  )
}
