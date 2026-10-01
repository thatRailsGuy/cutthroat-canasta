import type { Action, PlayerView, PublicPlayer } from '@canasta/engine'
import type { ClientMessage } from '@canasta/server/protocol'
import { useState, type ReactNode } from 'react'
import { rejoinLink } from '../api'
import { cardLabel } from '../cards'
import { Avatar } from '../components/Avatar'
import { CenterPile } from '../components/CenterPile'
import { Feed } from '../components/Feed'
import { GameOver } from '../components/GameOver'
import { Hand } from '../components/Hand'
import { MeldList } from '../components/MeldList'
import { OpponentPanel } from '../components/OpponentPanel'
import { RoundEnd } from '../components/RoundEnd'
import { RoundPoints } from '../components/RoundPoints'
import { ScorePad } from '../components/ScorePad'
import { ScoreSheet } from '../components/ScoreSheet'
import { SideSheet } from '../components/SideSheet'
import { StagingArea } from '../components/StagingArea'
import { TableEffects } from '../components/TableEffects'
import styles from '../components/Table.module.css'
import type { GameState } from '../gameState'
import { isCrowded, usePhone } from '../layout'
import { pickupHelpers, stagedIds, useStaging } from '../staging'

export interface TableProps {
  code: string
  view: PlayerView
  state: GameState
  send: (message: ClientMessage) => boolean
  /** Shown at the top of the side column: the tutorial's lesson card. */
  coach?: ReactNode
}

export function Table({ code, view, state, send, coach }: TableProps) {
  const [staging, dispatch] = useStaging(view)
  const round = view.round!
  const you = view.you!
  const currentId = view.players[round.current]?.id
  const yourTurn = view.status === 'playing' && currentId === you.id
  const isHost = state.playerId === state.hostId
  const act = (action: Action) => send({ type: 'action', action })
  const offline = state.connection !== 'open'
  const [scoresOpen, setScoresOpen] = useState(false)
  const [confirmQuit, setConfirmQuit] = useState(false)
  const inPlay = view.status === 'playing' || view.status === 'roundOver'
  // Point out the card you just drew from the stock, until you discard.
  const drawn =
    yourTurn && round.phase === 'play' ? you.hand.find((c) => c.id === you.drawnCard) : undefined
  // A game that ended because the others quit has no final round breakdown to show.
  const lastScoredThisRound = view.history.at(-1)?.round === round.number
  const yourSeat = view.players.findIndex((p) => p.id === you.id)
  const crowded = isCrowded(view)
  const phone = usePhone()
  const [sideOpen, setSideOpen] = useState(false)
  // A crowded table on a phone shows opponents as seat tiles; tapping one opens its panel.
  const seatTiles = phone && crowded
  const [peekId, setPeekId] = useState<string | null>(null)
  const isTurn = (p: PublicPlayer) => p.id === currentId && view.status === 'playing'
  const opponents = view.players
    .map((player, seat) => ({ player, seat }))
    .filter(({ player }) => player.id !== you.id)
  const panel = (p: PublicPlayer, seat: number) => {
    const token = state.rejoinTokens[p.id]
    return (
      <OpponentPanel
        key={p.id}
        player={p}
        seat={seat}
        isTurn={isTurn(p)}
        isConnected={state.connected.includes(p.id)}
        isHost={p.id === state.hostId}
        playing={view.status === 'playing'}
        onReissue={isHost ? () => send({ type: 'reissue', playerId: p.id }) : undefined}
        rejoinLink={token ? rejoinLink(code, token) : undefined}
        crowded={crowded || phone}
        // The panel opened from a seat tile has the room to show the melds' cards.
        chips={seatTiles ? false : undefined}
      />
    )
  }
  const peeked = seatTiles ? opponents.find(({ player }) => player.id === peekId) : undefined
  const hand = (
    <Hand
      cards={you.hand}
      selected={staging.selected}
      hidden={stagedIds(staging)}
      fresh={drawn?.id ?? null}
      rows={phone}
      onToggle={(cardId) => dispatch({ type: 'toggle', cardId })}
    />
  )
  const side = (
    <>
      <ScorePad view={view} onOpenSheet={() => setScoresOpen(true)} />
      <Feed events={round.feed} notices={state.notices} players={view.players} quit={view.quit} />
    </>
  )

  return (
    <main className={styles.table}>
      <div className={styles.play}>
        {phone && coach}
        <header className={`${styles.top} ${crowded || phone ? styles.crowdedTop : ''}`}>
          <h1 className={styles.logo}>
            <span className={styles.logoSmall}>Cutthroat</span> Canasta!
          </h1>
          {seatTiles ? (
            <div className={styles.seats}>
              {opponents.map(({ player, seat }) => (
                <SeatTile
                  key={player.id}
                  player={player}
                  seat={seat}
                  isTurn={isTurn(player)}
                  open={player.id === peekId}
                  onToggle={() => setPeekId(player.id === peekId ? null : player.id)}
                />
              ))}
            </div>
          ) : (
            <div
              className={`${styles.opponents} ${crowded ? styles.crowdedOpponents : ''} ${phone ? styles.phoneOpponents : ''}`}
            >
              {opponents.map(({ player, seat }) => panel(player, seat))}
            </div>
          )}
          {peeked && (
            <div id="peeked-seat" className={styles.peeked}>
              {panel(peeked.player, peeked.seat)}
            </div>
          )}
        </header>

        <CenterPile
          view={view}
          yourTurn={yourTurn}
          selected={staging.selected}
          staged={stagedIds(staging)}
          offline={offline}
          onToggleTop={(cardId) =>
            dispatch({ type: 'toggle', cardId, also: pickupHelpers(view, staging) })
          }
          onDraw={() => act({ type: 'drawStock' })}
        />

        {view.status === 'roundOver' && (
          <RoundEnd view={view} onNextRound={() => send({ type: 'nextRound' })} />
        )}
        {view.status === 'gameOver' && (
          <>
            {/* The final round's breakdown and hands stay visible, with no Next round. */}
            {lastScoredThisRound && <RoundEnd view={view} />}
            <GameOver view={view} />
          </>
        )}

        <section
          className={`${styles.you} ${yourTurn ? styles.turn : ''}`}
          aria-label="You"
          data-player-id={you.id}
        >
          <header>
            <Avatar name={you.name} seat={yourSeat} active={yourTurn} />
            <div className={styles.who}>
              <span className={styles.nameLine}>
                <strong>{you.name}</strong>
                <span className={styles.score}>{you.score.toLocaleString('en-US')} pts</span>
                <RoundPoints player={you} playing={view.status === 'playing'} />
              </span>
              <span className={styles.turnText}>{turnText(view, yourTurn)}</span>
            </div>
            {drawn && <span className={styles.drewNote}>You drew the {cardLabel(drawn)}</span>}
            <span className={styles.tools}>
              {inPlay && !confirmQuit && (
                <button type="button" onClick={() => setConfirmQuit(true)}>
                  Quit game
                </button>
              )}
            </span>
          </header>
          {confirmQuit && (
            <div className={styles.confirmQuit} role="alertdialog" aria-label="Quit the game?">
              <span>
                Quit for good? The others play on without you, and you can't come back to this game.
              </span>
              <button type="button" disabled={offline} onClick={() => send({ type: 'leave' })}>
                Quit
              </button>
              <button type="button" onClick={() => setConfirmQuit(false)}>
                Keep playing
              </button>
            </div>
          )}
          <MeldList
            melds={you.melds}
            red3s={you.red3s}
            onPick={(meldId) => dispatch({ type: 'stageAdd', meldId })}
          />
          {/* On a phone the buttons sit under the hand, where a thumb reaches them. */}
          {phone && hand}
          {view.status === 'playing' && (
            <StagingArea
              view={view}
              staging={staging}
              offline={offline}
              dispatch={dispatch}
              onAction={act}
            />
          )}
          {!phone && hand}
        </section>
      </div>

      {phone ? (
        <>
          <button type="button" className={styles.sideButton} onClick={() => setSideOpen(true)}>
            Scores
          </button>
          <SideSheet open={sideOpen} onClose={() => setSideOpen(false)}>
            {side}
          </SideSheet>
        </>
      ) : (
        <aside className={styles.side}>
          {coach}
          {side}
        </aside>
      )}
      <ScoreSheet view={view} open={scoresOpen} onClose={() => setScoresOpen(false)} />
      <TableEffects view={view} />
    </main>
  )
}

/** A crowded table on a phone: one opponent's seat, which opens their panel when tapped. */
function SeatTile({
  player,
  seat,
  isTurn,
  open,
  onToggle,
}: {
  player: PublicPlayer
  seat: number
  isTurn: boolean
  open: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      className={`${styles.seat} ${isTurn ? styles.turn : ''} ${open ? styles.seatOpen : ''}`}
      aria-expanded={open}
      aria-controls={open ? 'peeked-seat' : undefined}
      aria-label={`${player.name}${isTurn ? ', playing now' : ''}: ${player.score.toLocaleString('en-US')} points, ${player.handCount} cards`}
      data-player-id={player.id}
      onClick={onToggle}
    >
      <Avatar name={player.name} seat={seat} active={isTurn} />
      <span className={styles.seatName}>{player.name}</span>
      <span className={styles.seatLine}>{player.score.toLocaleString('en-US')}</span>
      <span className={styles.seatLine} data-hand-target="">
        {player.handCount} cards
      </span>
    </button>
  )
}

function turnText(view: PlayerView, yourTurn: boolean): string {
  if (view.status === 'roundOver') return 'Round over'
  if (view.status === 'gameOver') return 'Game over'
  const round = view.round!
  if (yourTurn) {
    return round.phase === 'draw'
      ? 'Your turn: draw or pick up the pile'
      : 'Your turn: meld, then discard'
  }
  return `Waiting for ${view.players[round.current]?.name ?? '…'}`
}
