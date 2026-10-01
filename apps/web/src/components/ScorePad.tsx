import type { PlayerView } from '@canasta/engine'
import type { CSSProperties } from 'react'
import { isCrowded } from '../layout'
import styles from './ScorePad.module.css'

export interface ScorePadProps {
  view: PlayerView
  /** Opens the full score sheet, with every round's breakdown. */
  onOpenSheet: () => void
}

/**
 * The paper score pad beside the table: one handwritten line per scored round and the running
 * total underneath, with the leader underlined. Players who quit are left off; the full score
 * sheet still has them. A crowded table has no room for a column each, so the pad lists the
 * players down the page with their last round and total.
 */
export function ScorePad({ view, onOpenSheet }: ScorePadProps) {
  const players = view.players
  const top = Math.max(...players.map((p) => p.score))
  const leaders = view.history.length > 0 ? players.filter((p) => p.score === top) : []
  const columns = { '--cols': players.length } as CSSProperties
  if (isCrowded(view)) {
    const last = view.history.at(-1)
    return (
      <section className={styles.pad} aria-label="Score pad">
        <table className={`${styles.table} ${styles.list}`}>
          <thead>
            <tr>
              <th scope="col">
                <span className={styles.hidden}>Player</span>
              </th>
              <th scope="col">{last ? `Rd ${last.round}` : ''}</th>
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id} aria-label={p.name}>
                <th scope="row" title={p.name}>
                  {p.name}
                </th>
                <td>{last ? (last.breakdown[p.id]?.total ?? '–') : ''}</td>
                <td className={leaders.includes(p) ? styles.leader : undefined}>{p.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {view.history.length === 0 && <p className={styles.none}>No rounds yet</p>}
        <button type="button" className={styles.sheet} onClick={onOpenSheet}>
          Scores
        </button>
      </section>
    )
  }
  return (
    <section className={styles.pad} aria-label="Score pad">
      <table className={styles.table} style={columns}>
        <thead>
          <tr>
            {players.map((p) => (
              <th key={p.id} scope="col" title={p.name}>
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.history.length === 0 && (
            <tr>
              <td colSpan={players.length} className={styles.none}>
                No rounds yet
              </td>
            </tr>
          )}
          {view.history.map((r) => (
            <tr key={r.round} aria-label={`Round ${r.round}`}>
              {players.map((p) => (
                <td key={p.id}>{r.breakdown[p.id]?.total ?? '–'}</td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr aria-label="Totals">
            {players.map((p) => (
              <td key={p.id} className={leaders.includes(p) ? styles.leader : undefined}>
                {p.score}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
      <button type="button" className={styles.sheet} onClick={onOpenSheet}>
        Scores
      </button>
    </section>
  )
}
