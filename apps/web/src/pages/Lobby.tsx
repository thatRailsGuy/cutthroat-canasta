import type { ClientMessage } from '@canasta/server/protocol'
import type { PlayerView } from '@canasta/engine'
import { MIN_PLAYERS } from '@canasta/engine'
import { QrCode } from '../components/QrCode'
import styles from './Pages.module.css'

export interface LobbyProps {
  code: string
  view: PlayerView
  playerId: string
  hostId: string | null
  connected: string[]
  send: (message: ClientMessage) => void
}

export function Lobby({ code, view, playerId, hostId, connected, send }: LobbyProps) {
  const isHost = playerId === hostId
  const shareLink = `${window.location.origin}/g/${code}`
  return (
    <main className={styles.lobby}>
      <h1>Game {code}</h1>
      <p>
        Share the code or this link: <a href={shareLink}>{shareLink}</a>
      </p>
      <QrCode text={shareLink} label={`QR code for ${shareLink}`} />
      <ul className={styles.seats}>
        {view.players.map((p) => (
          <li key={p.id}>
            <span
              className={connected.includes(p.id) ? styles.online : styles.offline}
              role="img"
              aria-label={connected.includes(p.id) ? 'Online' : 'Offline'}
            />
            {p.name}
            {p.id === hostId && ' (host)'}
            {p.id === playerId && ' (you)'}
            {isHost && p.id !== playerId && (
              <button type="button" onClick={() => send({ type: 'kick', playerId: p.id })}>
                Kick
              </button>
            )}
          </li>
        ))}
      </ul>
      {isHost ? (
        <button
          type="button"
          disabled={view.players.length < MIN_PLAYERS}
          onClick={() => send({ type: 'start' })}
        >
          Start game
        </button>
      ) : (
        <p>Waiting for the host to start.</p>
      )}
      <button type="button" onClick={() => send({ type: 'leave' })}>
        Leave
      </button>
    </main>
  )
}
