import type { Card as CardValue, CardId } from '@canasta/engine'
import type { CSSProperties } from 'react'
import { sortHand } from '../cards'
import { Card } from './Card'
import styles from './Table.module.css'

/** On a phone, a row holds at most this many cards; more start another row. */
export const ROW_LIMIT = 10

export interface HandProps {
  cards: CardValue[]
  selected: readonly CardId[]
  /** Staged cards stay in the staging area, so the hand hides them. */
  hidden: ReadonlySet<CardId>
  /** The card just drawn from the stock, marked so it stands out in the sorted hand. */
  fresh?: CardId | null
  /** Cards the tutorial points at. */
  lit?: readonly CardId[]
  /**
   * A phone: the hand is split into even rows of overlapping cards, each as wide as the
   * screen, instead of wrapping.
   */
  rows?: boolean
  onToggle: (cardId: CardId) => void
}

export function Hand({
  cards,
  selected,
  hidden,
  fresh = null,
  lit = [],
  rows = false,
  onToggle,
}: HandProps) {
  const shown = sortHand(cards).filter((c) => !hidden.has(c.id))
  const toCard = (c: CardValue) => (
    <Card
      key={c.id}
      card={c}
      selected={selected.includes(c.id)}
      fresh={c.id === fresh}
      lit={lit.includes(c.id)}
      onClick={() => onToggle(c.id)}
    />
  )
  if (!rows) {
    return (
      <section className={styles.hand} aria-label="Your hand" data-hand="">
        {shown.map(toCard)}
      </section>
    )
  }
  const perRow = Math.ceil(shown.length / Math.max(1, Math.ceil(shown.length / ROW_LIMIT)))
  const split = handRows(shown, perRow)
  return (
    <section
      className={`${styles.hand} ${styles.handRows}`}
      style={{ '--per-row': Math.max(perRow, 2) } as CSSProperties}
      aria-label="Your hand"
      data-hand=""
    >
      {split.map((row, i) => (
        <div key={i} className={styles.handRow}>
          {row.map(toCard)}
        </div>
      ))}
    </section>
  )
}

function handRows<T>(cards: T[], perRow: number): T[][] {
  const rows: T[][] = []
  const step = Math.max(perRow, 1)
  for (let i = 0; i < cards.length; i += step) rows.push(cards.slice(i, i + step))
  return rows
}
