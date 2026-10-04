import {
  MAX_PLAYERS,
  type Action,
  type CardId,
  type PlayerView,
  type PublicPlayer,
} from '@canasta/engine'
import type { ClientMessage } from '@canasta/server/protocol'
import { useEffect, useState, type ReactNode } from 'react'
import { rejoinLink } from '../api'
import { cardLabel } from '../cards'
import { Avatar } from '../components/Avatar'
import { CenterPile } from '../components/CenterPile'
import { Feed } from '../components/Feed'
import { GameOver } from '../components/GameOver'
import { HostDrawer } from '../components/HostDrawer'
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
import { TurnRail } from '../components/TurnRail'
import styles from '../components/Table.module.css'
import type { GameState } from '../gameState'
import { isCrowded, usePhone } from '../layout'
import { pickupHelpers, stagedIds, useStaging } from '../staging'
import { playOrder, turnText } from '../turnOrder'

export interface TableProps {
  code: string
  view: PlayerView
  state: GameState
  send: (message: ClientMessage) => boolean
  /**
   * The tutorial's lesson card. On a phone it sits above your hand; on a wider screen it
   * places itself over the table.
   */
  coach?: ReactNode
  /** Cards the tutorial points at, ringed in gold. */
  lit?: readonly CardId[]
}

export function Table({ code, view, state, send, coach, lit }: TableProps) {
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
  const [hostOpen, setHostOpen] = useState(false)
  const inPlay = view.status === 'playing' || view.status === 'roundOver'
  // Point out the card you just drew from the stock, until you discard.
  const drawn =
    yourTurn && round.phase === 'play' ? you.hand.find((c) => c.id === you.drawnCard) : undefined
  // A game that ended because the others quit has no final round breakdown to show.
  const lastScoredThisRound = view.history.at(-1)?.round === round.number
  const yourSeat = view.players.findIndex((p) => p.id === you.id)
  const crowded = isCrowded(view)
  // The root font size scales the whole page, so a crowded table marks the root to shrink it.
  useEffect(() => {
    if (!crowded) return
    document.documentElement.dataset.crowded = ''
    return () => {
      delete document.documentElement.dataset.crowded
    }
  }, [crowded])
  const phone = usePhone()
  const [sideOpen, setSideOpen] = useState(false)
  // A crowded table on a phone shows opponents as seat tiles; tapping one opens its panel.
  const seatTiles = phone && crowded
  const [peekId, setPeekId] = useState<string | null>(null)
  const isTurn = (p: PublicPlayer) => p.id === currentId && view.status === 'playing'
  // Opponents in the order they play after you, so the row reads the same way as the turn order.
  const opponents = playOrder(view.players, yourSeat + 1).filter(
    ({ player }) => player.id !== you.id,
  )
  const panel = (p: PublicPlayer, seat: number) => {
    return (
      <OpponentPanel
        key={p.id}
        player={p}
        seat={seat}
        isTurn={isTurn(p)}
        isConnected={state.connected.includes(p.id)}
        isHost={p.id === state.hostId}
        isDealer={seat === round.dealer}
        playing={view.status === 'playing'}
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
      lit={lit}
      rows={phone}
      onToggle={(cardId) => dispatch({ type: 'toggle', cardId })}
    />
  )
  const melds = (
    <MeldList
      melds={you.melds}
      red3s={you.red3s}
      onPick={(meldId) => dispatch({ type: 'stageAdd', meldId })}
    />
  )
  const stagingArea = view.status === 'playing' && (
    <StagingArea
      view={view}
      staging={staging}
      offline={offline}
      dispatch={dispatch}
      onAction={act}
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
        <header className={styles.top}>
          <h1 className={styles.logo}>
            <span className={styles.logoSmall}>Cutthroat</span> Canasta!
          </h1>
          <TurnRail view={view} />
          {seatTiles ? (
            <div className={styles.seats} data-coach="opponents">
              {opponents.map(({ player, seat }) => (
                <SeatTile
                  key={player.id}
                  player={player}
                  seat={seat}
                  isTurn={isTurn(player)}
                  isDealer={seat === round.dealer}
                  open={player.id === peekId}
                  onToggle={() => setPeekId(player.id === peekId ? null : player.id)}
                />
              ))}
            </div>
          ) : (
            <div
              className={`${styles.opponents} ${crowded ? styles.crowdedOpponents : ''} ${phone ? styles.phoneOpponents : ''}`}
              data-coach="opponents"
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
          lit={lit}
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
            <Avatar
              name={you.name}
              seat={yourSeat}
              active={yourTurn}
              dealer={yourSeat === round.dealer}
            />
            <div className={styles.who}>
              <span className={styles.nameLine}>
                <strong>{you.name}</strong>
                <span className={styles.score}>{you.score.toLocaleString('en-US')} pts</span>
                <RoundPoints player={you} playing={view.status === 'playing'} />
              </span>
              <span className={styles.turnText}>{turnText(view, yourTurn)}</span>
            </div>
            {drawn && <span className={styles.drewNote}>You drew the {cardLabel(drawn)}</span>}
          </header>
          {phone ? (
            <>
              {melds}
              {/* On a phone the buttons sit under the hand, where a thumb reaches them. */}
              {coach}
              {hand}
              {stagingArea}
            </>
          ) : (
            <>
              {/* Side by side, so the hand stays on screen without scrolling. */}
              <div className={styles.tableau}>
                {melds}
                {stagingArea}
              </div>
              {hand}
            </>
          )}
        </section>
      </div>

      {/* Fixed at the top, beside the Rules button. */}
      <div className={styles.gameTools}>
        {isHost && inPlay && (
          <button
            type="button"
            className={styles.toolButton}
            onClick={() => {
              setConfirmQuit(false)
              setHostOpen(true)
            }}
          >
            Host
          </button>
        )}
        {inPlay && (
          <button
            type="button"
            className={styles.toolButton}
            aria-expanded={confirmQuit}
            onClick={() => setConfirmQuit(!confirmQuit)}
          >
            Quit game
          </button>
        )}
        {phone && (
          <button type="button" onClick={() => setSideOpen(true)} data-coach="side">
            Scores
          </button>
        )}
      </div>
      {confirmQuit && (
        <div className={styles.toolConfirm} role="alertdialog" aria-label="Quit the game?">
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
      {isHost && (
        <HostDrawer
          open={hostOpen && inPlay}
          onClose={() => setHostOpen(false)}
          code={code}
          seats={opponents}
          waiting={view.waiting}
          full={view.players.length + view.waiting.length >= MAX_PLAYERS}
          playing={view.status === 'playing'}
          offline={offline}
          connected={state.connected}
          links={Object.fromEntries(
            Object.entries(state.rejoinTokens).map(([id, token]) => [id, rejoinLink(code, token)]),
          )}
          onReissue={(playerId) => send({ type: 'reissue', playerId })}
          onRedeal={() => send({ type: 'redeal' })}
        />
      )}
      {phone ? (
        <SideSheet open={sideOpen} onClose={() => setSideOpen(false)}>
          {side}
        </SideSheet>
      ) : (
        <aside className={styles.side} data-coach="side">
          {side}
        </aside>
      )}
      {!phone && coach}
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
  isDealer,
  open,
  onToggle,
}: {
  player: PublicPlayer
  seat: number
  isTurn: boolean
  isDealer: boolean
  open: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      className={`${styles.seat} ${isTurn ? styles.turn : ''} ${open ? styles.seatOpen : ''}`}
      aria-expanded={open}
      aria-controls={open ? 'peeked-seat' : undefined}
      aria-label={`${player.name}${isTurn ? ', playing now' : ''}${isDealer ? ', dealer' : ''}: ${player.score.toLocaleString('en-US')} points, ${player.handCount} cards`}
      data-player-id={player.id}
      onClick={onToggle}
    >
      <Avatar name={player.name} seat={seat} active={isTurn} dealer={isDealer} />
      <span className={styles.seatName}>{player.name}</span>
      <span className={styles.seatLine}>{player.score.toLocaleString('en-US')}</span>
      <span className={styles.seatLine} data-hand-target="">
        {player.handCount} cards
      </span>
    </button>
  )
}
