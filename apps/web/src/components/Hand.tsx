import type { Card as CardValue, CardId } from '@canasta/engine'
import { sortHand } from '../cards'
import { Card } from './Card'
import styles from './Table.module.css'

export interface HandProps {
  cards: CardValue[]
  selected: readonly CardId[]
  /** Staged cards stay in the staging area, so the hand hides them. */
  hidden: ReadonlySet<CardId>
  onToggle: (cardId: CardId) => void
}

export function Hand({ cards, selected, hidden, onToggle }: HandProps) {
  return (
    <section className={styles.hand} aria-label="Your hand">
      {sortHand(cards)
        .filter((c) => !hidden.has(c.id))
        .map((c) => (
          <Card
            key={c.id}
            card={c}
            selected={selected.includes(c.id)}
            onClick={() => onToggle(c.id)}
          />
        ))}
    </section>
  )
}
