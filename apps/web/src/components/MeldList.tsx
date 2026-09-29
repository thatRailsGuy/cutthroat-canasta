import { isCanasta, isNaturalCanasta, type Card as CardValue, type Meld } from '@canasta/engine'
import { CardRow } from './Card'
import styles from './Table.module.css'

export interface MeldListProps {
  melds: Meld[]
  red3s: CardValue[]
  /** Your own melds: clicking one stages the selected cards as an addition to it. */
  onPick?: (meldId: string) => void
}

/** Melds grouped by rank, with finished canastas marked natural or mixed. */
export function MeldList({ melds, red3s, onPick }: MeldListProps) {
  const ordered = [...melds].sort(
    (a, b) => a.rank.localeCompare(b.rank) || a.id.localeCompare(b.id),
  )
  return (
    <div className={styles.melds}>
      {ordered.map((meld) => {
        const label = isCanasta(meld)
          ? isNaturalCanasta(meld)
            ? 'Natural canasta'
            : 'Mixed canasta'
          : `${meld.cards.length} cards`
        const body = (
          <>
            <span className={styles.meldLabel}>
              {meld.rank}s · {label}
            </span>
            <CardRow cards={meld.cards} />
          </>
        )
        return onPick ? (
          <button
            key={meld.id}
            type="button"
            className={styles.meld}
            aria-label={`Add selected cards to your ${meld.rank}s (${label})`}
            onClick={() => onPick(meld.id)}
          >
            {body}
          </button>
        ) : (
          <div key={meld.id} className={styles.meld}>
            {body}
          </div>
        )
      })}
      {red3s.length > 0 && (
        <div className={styles.meld}>
          <span className={styles.meldLabel}>Red 3s</span>
          <CardRow cards={red3s} />
        </div>
      )}
    </div>
  )
}
