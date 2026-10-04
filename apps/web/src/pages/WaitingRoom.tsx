import type { PlayerView } from '@canasta/engine'
import type { ClientMessage } from '@canasta/server/protocol'
import styles from './Pages.module.css'

export interface WaitingRoomProps {
  view: PlayerView
  playerId: string
  connected: string[]
  send: (message: ClientMessage) => void
}

/** Someone who joined mid-game waits here, sitting out the hand, until the next one is dealt. */
export function WaitingRoom({ view, playerId, connected, send }: WaitingRoomProps) {
  const you = view.waiting.find((p) => p.id === playerId)
  const others = view.waiting.filter((p) => p.id !== playerId)
  return (
    <main className={styles.lobby}>
      <h1>Pull up a chair</h1>
      <p>
        You're in, {you?.name}. A hand is being played, so you'll be dealt in when the next one
        starts.
      </p>
      <h2 className={styles.subhead}>At the table</h2>
      <ul className={styles.seats}>
        {view.players.map((p) => (
          <li key={p.id}>
            <span
              className={connected.includes(p.id) ? styles.online : styles.offline}
              role="img"
              aria-label={connected.includes(p.id) ? 'Online' : 'Offline'}
            />
            {p.name}
          </li>
        ))}
      </ul>
      {others.length > 0 && <p>Also waiting: {others.map((p) => p.name).join(', ')}</p>}
      <button type="button" onClick={() => send({ type: 'leave' })}>
        Leave
      </button>
    </main>
  )
}
