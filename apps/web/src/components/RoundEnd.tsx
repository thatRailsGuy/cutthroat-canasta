import type { PlayerView } from '@canasta/engine'
import { BreakdownTable } from './BreakdownTable'
import { CardRow } from './Card'
import { CountUp } from './CountUp'
import styles from './Table.module.css'

export interface RoundEndProps {
  view: PlayerView
  onNextRound?: () => void
}

/** The last round's breakdowns and revealed hands, read from `view.history`. */
export function RoundEnd({ view, onNextRound }: RoundEndProps) {
  const last = view.history.at(-1)
  if (!last) return null
  const nameOf = (id: string) => view.players.find((p) => p.id === id)?.name ?? 'Someone'
  return (
    <section className={styles.roundEnd} aria-label={`Round ${last.round} scores`}>
      <h2>Round {last.round}</h2>
      <p>
        {last.endedBy === 'goingOut' && last.wentOut
          ? `${nameOf(last.wentOut)} went out.`
          : 'The stock ran out.'}
      </p>
      <BreakdownTable
        names={view.players.map((p) => p.name)}
        breakdowns={view.players.map((p) => last.breakdown[p.id])}
      />
      <table className={styles.totals}>
        <tbody>
          {view.players.map((p, i) => (
            <tr key={p.id}>
              <th scope="row">{p.name}</th>
              <td className={styles.rollTotal}>
                {/* The new total rolls up from last round's, one player after another. */}
                <CountUp
                  from={p.score - (last.breakdown[p.id]?.total ?? 0)}
                  to={p.score}
                  delay={i * 350}
                />
              </td>
              <td>
                <CardRow cards={last.hands[p.id] ?? []} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {onNextRound && (
        <button type="button" onClick={onNextRound}>
          Next round
        </button>
      )}
    </section>
  )
}
