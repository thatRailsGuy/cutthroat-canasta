import {
  isCanasta,
  isNatural,
  isNaturalCanasta,
  type Card as CardValue,
  type Meld,
} from '@canasta/engine'
import { isRed, rankIndex, rankPlural } from '../cards'
import { Card, CardRow } from './Card'
import styles from './Table.module.css'

export interface MeldListProps {
  melds: Meld[]
  red3s: CardValue[]
  /** Your own melds: clicking one stages the selected cards as an addition to it. */
  onPick?: (meldId: string) => void
}

/**
 * The card shown on top of a finished canasta, in the traditional way: a red card of its rank
 * for a natural canasta, a black one for a mixed canasta. If the meld has no natural card of
 * that colour, a stand-in of that colour is shown.
 */
export function canastaTopCard(meld: Meld): CardValue {
  const red = isNaturalCanasta(meld)
  const match = meld.cards.find((c) => isNatural(c) && isRed(c) === red)
  return match ?? { id: -1, rank: meld.rank, suit: red ? 'hearts' : 'spades' }
}

/** Melds grouped by rank. A finished canasta is squared up, with one card on top. */
export function MeldList({ melds, red3s, onPick }: MeldListProps) {
  const ordered = [...melds].sort(
    (a, b) => rankIndex(a.rank) - rankIndex(b.rank) || a.id.localeCompare(b.id),
  )
  return (
    <div className={styles.melds}>
      {ordered.map((meld) => {
        const label = isCanasta(meld)
          ? isNaturalCanasta(meld)
            ? 'Natural canasta'
            : 'Mixed canasta'
          : `${meld.cards.length} cards`
        const count = isCanasta(meld) ? ` · ${meld.cards.length} cards` : ''
        const body = (
          <>
            <span className={styles.meldLabel}>
              {rankPlural(meld.rank)} · {label}
              {count}
            </span>
            {isCanasta(meld) ? (
              <span
                className={styles.canastaPile}
                role="img"
                aria-label={`${meld.cards.length} cards squared up`}
              >
                <span aria-hidden="true">
                  <Card card={canastaTopCard(meld)} size="small" />
                </span>
              </span>
            ) : (
              <CardRow cards={meld.cards} />
            )}
          </>
        )
        return onPick ? (
          <button
            key={meld.id}
            type="button"
            className={styles.meld}
            aria-label={`Add selected cards to your ${rankPlural(meld.rank)} (${label})`}
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
