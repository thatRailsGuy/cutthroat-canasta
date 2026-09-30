import { initialMeldMinimum, tableScore, type Card, type Meld } from '@canasta/engine'
import styles from './Table.module.css'

export interface RoundPointsProps {
  player: { score: number; melds: Meld[]; red3s: Card[] }
  /** The round is in play, so the initial meld minimum still matters. */
  playing: boolean
}

/**
 * What the player would score if the round ended now, before going-out bonuses and cards left
 * in hand. Until they make their initial meld, also the points it needs.
 */
export function RoundPoints({ player, playing }: RoundPointsProps) {
  const points = tableScore(player)
  const title = `Melds ${points.meldPoints}, canasta bonuses ${points.canastaBonus}, Red 3s ${points.red3Points}`
  return (
    <>
      <span className={styles.roundPoints} title={title}>
        {points.total.toLocaleString('en-US')} on the table
      </span>
      {playing && player.melds.length === 0 && (
        <span className={styles.needs}>Needs {initialMeldMinimum(player.score)} to meld</span>
      )}
    </>
  )
}
