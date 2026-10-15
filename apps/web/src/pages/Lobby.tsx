import type { ChatLine, ClientMessage } from '@canasta/server/protocol'
import type { PlayerView } from '@canasta/engine'
import { MIN_PLAYERS } from '@canasta/engine'
import { useState } from 'react'
import { useHostAway } from '../away'
import { DisplayButton } from '../components/DisplayOptions'
import { GameCode } from '../components/GameCode'
import { QrCode } from '../components/QrCode'
import { TableTalk, type TalkControls } from '../components/TableTalk'
import type { KickedPlayer, SeatNotice } from '../gameState'
import styles from './Pages.module.css'

export interface LobbyProps {
  code: string
  view: PlayerView
  playerId: string
  hostId: string | null
  connected: string[]
  /** playerId → when each seated player without a connection went away, by this device's clock. */
  awaySince: Readonly<Record<string, number>>
  /** Listed on the home page. */
  isPublic: boolean
  /** Host only: players they kicked, who can be let back in. */
  kicked: KickedPlayer[]
  chat: readonly ChatLine[]
  /** Such as who stood in for the host with Play again. */
  notices: readonly SeatNotice[]
  offline: boolean
  send: (message: ClientMessage) => boolean
  talk: TalkControls
}

export function Lobby({
  code,
  view,
  playerId,
  hostId,
  connected,
  awaySince,
  isPublic,
  kicked,
  chat,
  notices,
  offline,
  send,
  talk,
}: LobbyProps) {
  const isHost = playerId === hostId
  // Once the host has been away a while anyone can start, and the server makes them host (as at
  // the table).
  const hostAway = useHostAway(hostId, connected, awaySince)
  const hostName = view.players.find((p) => p.id === hostId)?.name
  // The host's last kick, or the last player they let back in. Only this browser knows, so it
  // goes on a reload; the Kicked list stays.
  const [note, setNote] = useState<{ player: KickedPlayer; undone: boolean } | null>(null)
  const letBackIn = (player: KickedPlayer) => {
    if (send({ type: 'unkick', playerId: player.playerId })) setNote({ player, undone: true })
  }
  const shareLink = `${window.location.origin}/g/${code}`
  return (
    <main className={styles.lobby}>
      {/* Fixed at the top, beside the Rules button, as at the table. */}
      <div className={styles.pageTools}>
        <DisplayButton />
      </div>
      <h1>Pull up a chair</h1>
      <GameCode code={code} />
      <p>
        Or share this link: <a href={shareLink}>{shareLink}</a>
      </p>
      <QrCode text={shareLink} label={`QR code for ${shareLink}`} />
      {isHost ? (
        <PublicSwitch
          isPublic={isPublic}
          host={view.players.find((p) => p.id === playerId)?.name ?? ''}
          onChange={(value) => send({ type: 'setPublic', public: value })}
        />
      ) : (
        isPublic && <span className={styles.publicChip}>● Public table</span>
      )}
      {note && (
        <p className={styles.kicked} role="status">
          {note.undone ? (
            <span>{note.player.name} can join again with the code or link.</span>
          ) : (
            <>
              <span>You kicked {note.player.name}. They can't join this game again.</span>
              <button type="button" onClick={() => letBackIn(note.player)}>
                Undo
              </button>
            </>
          )}
        </p>
      )}
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
            {/* The dot already says Offline to a screen reader. */}
            {!connected.includes(p.id) && (
              <span className={styles.away} aria-hidden="true">
                away
              </span>
            )}
            {isHost && p.id !== playerId && (
              <button
                type="button"
                onClick={() => {
                  if (send({ type: 'kick', playerId: p.id })) {
                    setNote({ player: { playerId: p.id, name: p.name }, undone: false })
                  }
                }}
              >
                Kick
              </button>
            )}
          </li>
        ))}
      </ul>
      {isHost && kicked.length > 0 && (
        <section className={styles.kickedList} aria-labelledby="kicked-heading">
          <h2 id="kicked-heading">Kicked</h2>
          <ul>
            {kicked.map((k) => (
              <li key={k.playerId}>
                <span>{k.name}</span>
                <button type="button" onClick={() => letBackIn(k)}>
                  Let back in
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <TableTalk
        events={[]}
        deal={null}
        chat={chat}
        notices={notices}
        players={view.players}
        playerId={playerId}
        offline={offline}
        talk={talk}
      />
      {!isHost && hostAway && (
        <p>
          {hostName
            ? `${hostName} is the host, but they're away. If you start the game, you become the host. ${hostName} will be dealt in too. If ${hostName} doesn't come back, use the Host button at the table to make a rejoin link for ${hostName}'s seat.`
            : 'The host is away. If you start the game, you become the host.'}
        </p>
      )}
      {isHost || hostAway ? (
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

function PublicSwitch({
  isPublic,
  host,
  onChange,
}: {
  isPublic: boolean
  host: string
  onChange: (value: boolean) => void
}) {
  return (
    <div className={isPublic ? `${styles.public} ${styles.publicOn}` : styles.public}>
      <button
        type="button"
        role="switch"
        className={styles.switch}
        aria-checked={isPublic}
        aria-labelledby="public-state"
        aria-describedby="public-why"
        onClick={() => onChange(!isPublic)}
      />
      <span id="public-state" className={styles.publicState}>
        {isPublic ? 'Public' : 'Private'}
      </span>
      <span id="public-why" className={styles.publicWhy}>
        {isPublic
          ? `Listed on the home page as "${host}'s table" until the game starts. Anyone can join.`
          : 'Only people with the code or link can join.'}
      </span>
    </div>
  )
}
