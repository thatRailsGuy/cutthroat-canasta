import type { Action, PlayerView } from '@canasta/engine'
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
import { StagingArea } from '../components/StagingArea'
import { TableEffects } from '../components/TableEffects'
import styles from '../components/Table.module.css'
import type { GameState } from '../gameState'
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

  return (
    <main className={styles.table}>
      <div className={styles.play}>
        <header className={styles.top}>
          <h1 className={styles.logo}>
            <span className={styles.logoSmall}>Cutthroat</span> Canasta!
          </h1>
          <div className={styles.opponents}>
            {view.players.map((p, seat) => {
              if (p.id === you.id) return null
              const token = state.rejoinTokens[p.id]
              return (
                <OpponentPanel
                  key={p.id}
                  player={p}
                  seat={seat}
                  isTurn={p.id === currentId && view.status === 'playing'}
                  isConnected={state.connected.includes(p.id)}
                  isHost={p.id === state.hostId}
                  playing={view.status === 'playing'}
                  onReissue={isHost ? () => send({ type: 'reissue', playerId: p.id }) : undefined}
                  rejoinLink={token ? rejoinLink(code, token) : undefined}
                />
              )
            })}
          </div>
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
          {view.status === 'playing' && (
            <StagingArea
              view={view}
              staging={staging}
              offline={offline}
              dispatch={dispatch}
              onAction={act}
            />
          )}
          <Hand
            cards={you.hand}
            selected={staging.selected}
            hidden={stagedIds(staging)}
            fresh={drawn?.id ?? null}
            onToggle={(cardId) => dispatch({ type: 'toggle', cardId })}
          />
        </section>
      </div>

      <aside className={styles.side}>
        {coach}
        <ScorePad view={view} onOpenSheet={() => setScoresOpen(true)} />
        <Feed events={round.feed} notices={state.notices} players={view.players} quit={view.quit} />
      </aside>
      <ScoreSheet view={view} open={scoresOpen} onClose={() => setScoresOpen(false)} />
      <TableEffects view={view} />
    </main>
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
