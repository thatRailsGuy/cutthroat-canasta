import type { PlayerView } from '@canasta/engine'
import { Link } from 'react-router'
import styles from './Table.module.css'

export interface GameOverProps {
  view: PlayerView
  playerId: string | null
  hostId: string | null
  connected: readonly string[]
  offline: boolean
  onPlayAgain: () => void
}

export function GameOver({
  view,
  playerId,
  hostId,
  connected,
  offline,
  onPlayAgain,
}: GameOverProps) {
  const ranked = [...view.players].sort((a, b) => b.score - a.score)
  const winnerNames = view.winners.map((id) => view.players.find((p) => p.id === id)?.name ?? '?')
  // The engine always names winners at game end; the top score is a fallback, never a blank.
  const names = winnerNames.length > 0 ? winnerNames : ranked.slice(0, 1).map((p) => p.name)
  const seated = [...view.players, ...view.waiting]
  const here = seated.filter((p) => connected.includes(p.id))
  const host = seated.find((p) => p.id === hostId)
  // The host starts the next game. While they're away, anyone at the table can.
  const hostHere = host !== undefined && connected.includes(host.id)
  const canStart = seated.some((p) => p.id === playerId) && (playerId === hostId || !hostHere)
  return (
    <section className={styles.gameOver} aria-label="Game over">
      <h2>{names.length > 1 ? `${names.join(' and ')} share the win!` : `${names[0]} wins!`}</h2>
      {view.players.length === 1 && view.quit.length > 0 && <p>Everyone else quit the game.</p>}
      <table className={styles.totals}>
        <thead>
          <tr>
            <th scope="col">Player</th>
            {view.history.map((r) => (
              <th key={r.round} scope="col">
                R{r.round}
              </th>
            ))}
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((p) => (
            <tr key={p.id}>
              <th scope="row">{p.name}</th>
              {view.history.map((r) => (
                <td key={r.round}>{r.breakdown[p.id]?.total ?? 0}</td>
              ))}
              <td>{p.score.toLocaleString('en-US')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {canStart ? (
        <div className={styles.stillHere}>
          <span className={styles.stillHereLabel} id="still-here">
            Still here
          </span>
          <ul aria-labelledby="still-here">
            {here.map((p) => (
              <li key={p.id}>{p.name}</li>
            ))}
          </ul>
        </div>
      ) : (
        host && (
          <p className={styles.waitLine}>Waiting for {host.name} (host) to start another game.</p>
        )
      )}
      <div className={styles.gameOverActions}>
        {canStart && (
          <button
            type="button"
            className={styles.playAgain}
            disabled={offline}
            onClick={onPlayAgain}
          >
            Play again
          </button>
        )}
        {/* A link, so it still opens in a new tab, drawn as one of the table's buttons. */}
        <Link className={styles.menuLink} to="/">
          Main menu
        </Link>
      </div>
    </section>
  )
}
