import type { Card as CardValue } from '@canasta/engine'
import type { KeyboardEvent, PointerEvent } from 'react'
import { SUIT_SYMBOLS, cardName, isRed } from '../cards'
import styles from './Card.module.css'

export interface CardProps {
  card: CardValue
  selected?: boolean
  size?: 'normal' | 'small'
  /** Just drawn: highlighted so it stands out. */
  fresh?: boolean
  /** The tutorial points at it. */
  lit?: boolean
  /** Makes the card a toggle button. Without it the card is a picture. */
  onClick?: () => void
  /** For a card in your hand: starts a drag. */
  onPointerDown?: (event: PointerEvent<HTMLButtonElement>) => void
  onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void
}

export function Card({
  card,
  selected = false,
  size = 'normal',
  fresh = false,
  lit = false,
  onClick,
  onPointerDown,
  onKeyDown,
}: CardProps) {
  const className = [
    styles.card,
    styles[size],
    card.suit ? (isRed(card) ? styles.red : styles.black) : styles.joker,
    selected ? styles.selected : '',
    fresh ? styles.fresh : '',
    lit ? styles.lit : '',
  ].join(' ')
  const suit = card.suit ? SUIT_SYMBOLS[card.suit] : '★'
  const face = (
    <>
      <span className={styles.corner} aria-hidden="true">
        <span className={styles.rank}>{card.suit ? card.rank : 'JK'}</span>
        <span className={styles.suit}>{suit}</span>
      </span>
      <span className={styles.pip} aria-hidden="true">
        {suit}
      </span>
    </>
  )
  if (!onClick) {
    return (
      <span className={className} role="img" aria-label={cardName(card)} data-card-id={card.id}>
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
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      data-card-id={card.id}
    >
      {face}
    </button>
  )
}

/** The back of a card: teal, with a starburst. */
export function CardBack({ size = 'normal' }: { size?: 'normal' | 'small' | 'tiny' }) {
  return (
    <span className={`${styles.back} ${styles[size]}`} aria-hidden="true" data-back="">
      <svg viewBox="0 0 54 54" fill="none" strokeWidth="2.5" strokeLinecap="round">
        <path d="M27 4v46M4 27h46M10.7 10.7l32.6 32.6M43.3 10.7 10.7 43.3" />
        <circle cx="27" cy="27" r="6" />
      </svg>
    </span>
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
