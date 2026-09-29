import type { Action, PlayerView } from '@canasta/engine'
import type { ClientMessage } from '@canasta/server/protocol'
import { rejoinLink } from '../api'
import { CenterPile } from '../components/CenterPile'
import { Feed } from '../components/Feed'
import { GameOver } from '../components/GameOver'
import { Hand } from '../components/Hand'
import { MeldList } from '../components/MeldList'
import { OpponentPanel } from '../components/OpponentPanel'
import { RoundEnd } from '../components/RoundEnd'
import { StagingArea } from '../components/StagingArea'
import styles from '../components/Table.module.css'
import type { GameState } from '../gameState'
import { stagedIds, useStaging } from '../staging'

export interface TableProps {
  code: string
  view: PlayerView
  state: GameState
  send: (message: ClientMessage) => void
}

export function Table({ code, view, state, send }: TableProps) {
  const [staging, dispatch] = useStaging(view)
  const round = view.round!
  const you = view.you!
  const currentId = view.players[round.current]?.id
  const yourTurn = view.status === 'playing' && currentId === you.id
  const isHost = state.playerId === state.hostId
  const act = (action: Action) => send({ type: 'action', action })

  return (
    <main className={styles.table}>
      <div className={styles.opponents}>
        {view.players
          .filter((p) => p.id !== you.id)
          .map((p) => {
            const token = state.rejoinTokens[p.id]
            return (
              <OpponentPanel
                key={p.id}
                player={p}
                isTurn={p.id === currentId && view.status === 'playing'}
                isConnected={state.connected.includes(p.id)}
                isHost={p.id === state.hostId}
                onReissue={isHost ? () => send({ type: 'reissue', playerId: p.id }) : undefined}
                rejoinLink={token ? rejoinLink(code, token) : undefined}
              />
            )
          })}
      </div>

      <CenterPile
        view={view}
        yourTurn={yourTurn}
        selected={staging.selected}
        onToggleTop={(cardId) => dispatch({ type: 'toggle', cardId })}
        onDraw={() => act({ type: 'drawStock' })}
      />

      <Feed events={round.feed} notices={state.notices} players={view.players} />

      {view.status === 'roundOver' && (
        <RoundEnd view={view} onNextRound={() => send({ type: 'nextRound' })} />
      )}
      {view.status === 'gameOver' && <GameOver view={view} />}

      <section className={`${styles.you} ${yourTurn ? styles.turn : ''}`} aria-label="You">
        <header>
          <strong>{you.name}</strong> · {you.score.toLocaleString('en-US')} pts ·{' '}
          {yourTurn
            ? round.phase === 'draw'
              ? 'Your turn: draw or pick up the pile'
              : 'Your turn: meld, then discard'
            : `Waiting for ${view.players[round.current]?.name ?? '…'}`}
        </header>
        <MeldList
          melds={you.melds}
          red3s={you.red3s}
          onPick={(meldId) => dispatch({ type: 'stageAdd', meldId })}
        />
        {view.status === 'playing' && (
          <StagingArea view={view} staging={staging} dispatch={dispatch} onAction={act} />
        )}
        <Hand
          cards={you.hand}
          selected={staging.selected}
          hidden={stagedIds(staging)}
          onToggle={(cardId) => dispatch({ type: 'toggle', cardId })}
        />
      </section>
    </main>
  )
}
