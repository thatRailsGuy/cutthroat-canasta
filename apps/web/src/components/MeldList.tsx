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
  /**
   * A crowded table: each meld is a chip with its rank and card count, and no cards. Not for
   * your own melds, which you click to add to.
   */
  chips?: boolean
}

/**
 * The card shown on top of a finished canasta, in the traditional way: a red card of its rank
 * for a clean canasta, a black one for a dirty canasta. If the meld has no natural card of
 * that colour, a stand-in of that colour is shown.
 */
export function canastaTopCard(meld: Meld): CardValue {
  const red = isNaturalCanasta(meld)
  const match = meld.cards.find((c) => isNatural(c) && isRed(c) === red)
  return match ?? { id: -1, rank: meld.rank, suit: red ? 'hearts' : 'spades' }
}

/**
 * Melds in rank order, each an overlapping column of cards. A finished canasta is squared up,
 * with one card on top and a ribbon saying clean or dirty.
 */
export function MeldList({ melds, red3s, onPick, compact = false, chips = false }: MeldListProps) {
  const ordered = [...melds].sort(
    (a, b) => rankIndex(a.rank) - rankIndex(b.rank) || a.id.localeCompare(b.id),
  )
  if (chips) return <MeldChips melds={ordered} red3s={red3s} />
  return (
    <div className={`${styles.melds} ${compact ? styles.compact : ''}`}>
      {ordered.map((meld) => {
        const canasta = isCanasta(meld)
        const natural = canasta && isNaturalCanasta(meld)
        const label = canasta
          ? `${natural ? 'Clean' : 'Dirty'} canasta, ${meld.cards.length} cards`
          : `${meld.cards.length} cards`
        const body = (
          <>
            {canasta ? (
              <span className={styles.canasta}>
                <span className={styles.squared} aria-hidden="true">
                  <Card card={canastaTopCard(meld)} size="small" />
                </span>
                <span className={`${styles.ribbon} ${natural ? styles.clean : styles.dirty}`}>
                  {natural ? 'Clean' : 'Dirty'}
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
            data-drop={`meld:${meld.id}`}
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

/**
 * One chip per meld: its rank and how many cards, filled in when it is a canasta. Hovering,
 * focusing, or tapping a chip shows its cards, so you can still see which are wild.
 */
function MeldChips({ melds, red3s }: { melds: Meld[]; red3s: CardValue[] }) {
  return (
    <div className={styles.chips}>
      {melds.map((meld) => {
        const canasta = isCanasta(meld)
        const natural = canasta && isNaturalCanasta(meld)
        const kind = canasta ? (natural ? styles.clean : styles.dirty) : ''
        const label = canasta
          ? `${natural ? 'Clean' : 'Dirty'} canasta, ${meld.cards.length} cards`
          : `${meld.cards.length} cards`
        return (
          <span
            key={meld.id}
            className={`${styles.chip} ${kind}`}
            data-meld-id={meld.id}
            data-rank={meld.rank}
            data-canasta={canasta || undefined}
            role="img"
            aria-label={`${rankPlural(meld.rank)}: ${label}`}
            tabIndex={0}
          >
            <span className={styles.chipRank}>{meld.rank}</span>×{meld.cards.length}
            <Peek cards={meld.cards} />
          </span>
        )
      })}
      {red3s.length > 0 && (
        <span
          className={`${styles.chip} ${styles.red3Chip}`}
          data-red3s=""
          role="img"
          aria-label={`Red 3s: ${red3s.length}`}
          tabIndex={0}
        >
          <span className={styles.chipRank}>3♥</span>×{red3s.length}
          <Peek cards={red3s} />
        </span>
      )}
    </div>
  )
}

/** The cards behind a chip, fanned out in a popup. */
function Peek({ cards }: { cards: CardValue[] }) {
  return (
    <span className={styles.peek} aria-hidden="true">
      {cards.map((c) => (
        <Card key={c.id} card={c} size="small" />
      ))}
    </span>
  )
}
