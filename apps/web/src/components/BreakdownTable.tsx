import type { ScoreBreakdown } from '@canasta/engine'
import styles from './Table.module.css'

/** One column per player, one row per line of the round-scoring rule (spec 3.8). */
const BREAKDOWN_ROWS: { key: keyof ScoreBreakdown; label: string; sign?: -1 }[] = [
  { key: 'meldPoints', label: 'Cards in melds' },
  { key: 'canastaBonus', label: 'Canasta bonuses' },
  { key: 'red3Points', label: 'Red 3s' },
  { key: 'goingOutBonus', label: 'Going out' },
  { key: 'concealedBonus', label: 'Concealed hand' },
  { key: 'handPenalty', label: 'Cards left in hand', sign: -1 },
  { key: 'total', label: 'Round total' },
]

export function BreakdownTable({
  names,
  breakdowns,
}: {
  names: string[]
  breakdowns: ScoreBreakdown[]
}) {
  return (
    <table className={styles.breakdown}>
      <thead>
        <tr>
          <th scope="col">Score</th>
          {names.map((name) => (
            <th key={name} scope="col">
              {name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {BREAKDOWN_ROWS.map((row) => (
          <tr key={row.key}>
            <th scope="row">{row.label}</th>
            {breakdowns.map((b, i) => (
              <td key={i}>{(row.sign ?? 1) * b[row.key]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
