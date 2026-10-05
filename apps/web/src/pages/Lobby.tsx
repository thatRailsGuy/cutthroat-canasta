import type { ChatLine, ClientMessage } from '@canasta/server/protocol'
import type { PlayerView } from '@canasta/engine'
import { MIN_PLAYERS } from '@canasta/engine'
import { GameCode } from '../components/GameCode'
import { QrCode } from '../components/QrCode'
import { TableTalk, type TalkControls } from '../components/TableTalk'
import styles from './Pages.module.css'

export interface LobbyProps {
  code: string
  view: PlayerView
  playerId: string
  hostId: string | null
  connected: string[]
  chat: readonly ChatLine[]
  offline: boolean
  send: (message: ClientMessage) => void
  talk: TalkControls
}

export function Lobby({
  code,
  view,
  playerId,
  hostId,
  connected,
  chat,
  offline,
  send,
  talk,
}: LobbyProps) {
  const isHost = playerId === hostId
  const shareLink = `${window.location.origin}/g/${code}`
  return (
    <main className={styles.lobby}>
      <h1>Pull up a chair</h1>
      <GameCode code={code} />
      <p>
        Or share this link: <a href={shareLink}>{shareLink}</a>
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
      <TableTalk
        events={[]}
        deal={null}
        chat={chat}
        notices={[]}
        players={view.players}
        playerId={playerId}
        offline={offline}
        talk={talk}
      />
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
