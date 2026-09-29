import type { PlayerView } from '@canasta/engine'
import { Link } from 'react-router'
import styles from './Table.module.css'

export function GameOver({ view }: { view: PlayerView }) {
  const names = view.winners.map((id) => view.players.find((p) => p.id === id)?.name ?? '?')
  const ranked = [...view.players].sort((a, b) => b.score - a.score)
  return (
    <section className={styles.gameOver} aria-label="Game over">
      <h2>{names.length > 1 ? `${names.join(' and ')} share the win!` : `${names[0]} wins!`}</h2>
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
      <Link to="/">New game</Link>
    </section>
  )
}
