import type { Card as CardValue } from '@canasta/engine'
import { SUIT_SYMBOLS, cardName, isRed } from '../cards'
import styles from './Card.module.css'

export interface CardProps {
  card: CardValue
  selected?: boolean
  size?: 'normal' | 'small'
  /** Just drawn: highlighted so it stands out. */
  fresh?: boolean
  /** Makes the card a toggle button. Without it the card is a picture. */
  onClick?: () => void
}

export function Card({
  card,
  selected = false,
  size = 'normal',
  fresh = false,
  onClick,
}: CardProps) {
  const className = [
    styles.card,
    styles[size],
    isRed(card) ? styles.red : styles.black,
    selected ? styles.selected : '',
    fresh ? styles.fresh : '',
  ].join(' ')
  const face = card.suit ? (
    <>
      <span>{card.rank}</span>
      <span>{SUIT_SYMBOLS[card.suit]}</span>
    </>
  ) : (
    <span className={styles.joker}>★</span>
  )
  if (!onClick) {
    return (
      <span className={className} role="img" aria-label={cardName(card)}>
        {face}
      </span>
    )
  }
  return (
    <button
      type="button"
      className={className}
      aria-label={fresh ? `${cardName(card)}, just drawn` : cardName(card)}
      aria-pressed={selected}
      onClick={onClick}
    >
      {face}
    </button>
  )
}

export function CardRow({
  cards,
  size = 'small',
}: {
  cards: CardValue[]
  size?: 'normal' | 'small'
}) {
  return (
    <span className={styles.row}>
      {cards.map((c) => (
        <Card key={c.id} card={c} size={size} />
      ))}
    </span>
  )
}
