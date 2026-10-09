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
 * players down the page with their last round and total. Players waiting for the next deal are
 * pencilled in faintly at 0.
 */
export function ScorePad({ view, onOpenSheet }: ScorePadProps) {
  const players = view.players
  // `?? []`: a view from a server that predates mid-game joining.
  const late = view.waiting ?? []
  const top = Math.max(...players.map((p) => p.score))
  const leaders = view.history.length > 0 ? players.filter((p) => p.score === top) : []
  const columns = { '--cols': players.length + late.length } as CSSProperties
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
              <tr key={p.id}>
                <th scope="row" title={p.name}>
                  {p.name}
                </th>
                <td>{last ? (last.breakdown[p.id]?.total ?? '–') : ''}</td>
                <Total score={p.score} leading={leaders.includes(p)} />
              </tr>
            ))}
            {late.map((p) => (
              <tr key={p.id} className={styles.late}>
                <th scope="row" title={p.name}>
                  {p.name}
                  <span className="sr-only">, dealt in next hand</span>
                </th>
                <td />
                <td>0</td>
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
            {late.map((p) => (
              <th
                key={p.id}
                scope="col"
                title={`${p.name}, dealt in next hand`}
                className={styles.late}
              >
                {p.name}
                <span className="sr-only">, dealt in next hand</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.history.length === 0 && (
            <tr>
              <td colSpan={players.length + late.length} className={styles.none}>
                No rounds yet
              </td>
            </tr>
          )}
          {view.history.map((r) => (
            <tr key={r.round} aria-label={`Round ${r.round}`}>
              {players.map((p) => (
                <td key={p.id}>{r.breakdown[p.id]?.total ?? '–'}</td>
              ))}
              {late.map((p) => (
                <td key={p.id} className={styles.late} />
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr aria-label="Totals">
            {players.map((p) => (
              <Total key={p.id} score={p.score} leading={leaders.includes(p)} />
            ))}
            {late.map((p) => (
              <td key={p.id} className={styles.late}>
                0
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

/** A running total. The leader's is underlined, and a screen reader hears "leading". */
function Total({ score, leading }: { score: number; leading: boolean }) {
  return (
    <td className={leading ? styles.leader : undefined}>
      {score}
      {leading && <span className="sr-only">, leading</span>}
    </td>
  )
}
