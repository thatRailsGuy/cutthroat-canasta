import {
  isCanasta,
  isNatural,
  isNaturalCanasta,
  type Card as CardValue,
  type Meld,
} from '@canasta/engine'
import type { CSSProperties } from 'react'
import { isRed, rankIndex, rankPlural } from '../cards'
import { Card } from './Card'
import styles from './MeldList.module.css'

export interface MeldListProps {
  melds: Meld[]
  red3s: CardValue[]
  /** Your own melds: clicking one stages the selected cards as an addition to it. */
  onPick?: (meldId: string) => void
  /** Opponents' melds overlap more, so their panels stay short. */
  compact?: boolean
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

/**
 * Melds in rank order, each an overlapping column of cards. A finished canasta is squared up,
 * with one card on top and a ribbon saying natural or mixed.
 */
export function MeldList({ melds, red3s, onPick, compact = false }: MeldListProps) {
  const ordered = [...melds].sort(
    (a, b) => rankIndex(a.rank) - rankIndex(b.rank) || a.id.localeCompare(b.id),
  )
  return (
    <div className={`${styles.melds} ${compact ? styles.compact : ''}`}>
      {ordered.map((meld) => {
        const canasta = isCanasta(meld)
        const natural = canasta && isNaturalCanasta(meld)
        const label = canasta
          ? `${natural ? 'Natural' : 'Mixed'} canasta, ${meld.cards.length} cards`
          : `${meld.cards.length} cards`
        const body = (
          <>
            {canasta ? (
              <span className={styles.canasta}>
                <span className={styles.squared} aria-hidden="true">
                  <Card card={canastaTopCard(meld)} size="small" />
                </span>
                <span className={`${styles.ribbon} ${natural ? styles.natural : styles.mixed}`}>
                  {natural ? 'Natural' : 'Mixed'}
                </span>
              </span>
            ) : (
              <span
                className={styles.column}
                style={{ '--n': meld.cards.length } as CSSProperties}
                aria-hidden="true"
              >
                {meld.cards.map((c, i) => (
                  <span key={c.id} className={styles.slot} style={{ '--i': i } as CSSProperties}>
                    <Card card={c} size="small" />
                  </span>
                ))}
              </span>
            )}
            <span className={styles.caption}>
              {canasta ? `${meld.cards.length} cards` : `${meld.cards.length} of 7`}
            </span>
          </>
        )
        const name = `${rankPlural(meld.rank)}: ${label}`
        return onPick ? (
          <button
            key={meld.id}
            type="button"
            className={styles.meld}
            data-meld-id={meld.id}
            data-rank={meld.rank}
            data-canasta={canasta || undefined}
            aria-label={`Add selected cards to your ${rankPlural(meld.rank)} (${label})`}
            onClick={() => onPick(meld.id)}
          >
            {body}
          </button>
        ) : (
          <div
            key={meld.id}
            className={styles.meld}
            data-meld-id={meld.id}
            data-rank={meld.rank}
            data-canasta={canasta || undefined}
            role="img"
            aria-label={name}
          >
            {body}
          </div>
        )
      })}
      {red3s.length > 0 && (
        <div
          className={styles.meld}
          data-red3s=""
          role="img"
          aria-label={`Red 3s: ${red3s.length}`}
        >
          <span
            className={styles.column}
            style={{ '--n': red3s.length } as CSSProperties}
            aria-hidden="true"
          >
            {red3s.map((c, i) => (
              <span key={c.id} className={styles.slot} style={{ '--i': i } as CSSProperties}>
                <Card card={c} size="small" />
              </span>
            ))}
          </span>
          <span className={styles.caption}>Red 3s</span>
        </div>
      )}
    </div>
  )
}
