import type { Card as CardValue, CardId } from '@canasta/engine'
import { sortHand } from '../cards'
import { Card } from './Card'
import styles from './Table.module.css'

export interface HandProps {
  cards: CardValue[]
  selected: readonly CardId[]
  /** Staged cards stay in the staging area, so the hand hides them. */
  hidden: ReadonlySet<CardId>
  /** The card just drawn from the stock, marked so it stands out in the sorted hand. */
  fresh?: CardId | null
  onToggle: (cardId: CardId) => void
}

export function Hand({ cards, selected, hidden, fresh = null, onToggle }: HandProps) {
  return (
    <section className={styles.hand} aria-label="Your hand">
      {sortHand(cards)
        .filter((c) => !hidden.has(c.id))
        .map((c) => (
          <Card
            key={c.id}
            card={c}
            selected={selected.includes(c.id)}
            fresh={c.id === fresh}
            onClick={() => onToggle(c.id)}
          />
        ))}
    </section>
  )
}
