import type { PublicPlayer } from '@canasta/engine'
import { useRef, useState } from 'react'
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
          role="img"
          aria-label={isConnected ? 'Online' : 'Offline'}
          title={isConnected ? 'Online' : 'Offline'}
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
  const inputRef = useRef<HTMLInputElement>(null)
  const [copyResult, setCopyResult] = useState<'copied' | 'manual' | null>(null)
  if (!link) {
    return (
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
