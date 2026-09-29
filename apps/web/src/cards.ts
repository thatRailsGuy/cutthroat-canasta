import type { Card, Rank, Suit } from '@canasta/engine'

export const SUIT_SYMBOLS: Record<Suit, string> = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠',
}

const RANK_NAMES: Record<Rank, string> = {
  A: 'Ace',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  J: 'Jack',
  Q: 'Queen',
  K: 'King',
  JOKER: 'Joker',
}

/** Hand order: wilds first, then Ace down to 4, then 3s. */
const RANK_ORDER: Rank[] = [
  'JOKER',
  '2',
  'A',
  'K',
  'Q',
  'J',
  '10',
  '9',
  '8',
  '7',
  '6',
  '5',
  '4',
  '3',
]
const SUIT_ORDER: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds']

/** Position in hand order (wilds, Ace down to 4, then 3s), for sorting by rank. */
export function rankIndex(rank: Rank): number {
  return RANK_ORDER.indexOf(rank)
}

/** A rank in the plural, for meld labels: "Aces", "Kings", "7s". */
export function rankPlural(rank: Rank): string {
  return `${RANK_NAMES[rank]}s`
}

export function isRed(card: Card): boolean {
  return card.suit === 'hearts' || card.suit === 'diamonds'
}

/** Short label for the feed and toasts, such as "7♥" or "Joker". */
export function cardLabel(card: Card): string {
  return card.suit ? `${card.rank}${SUIT_SYMBOLS[card.suit]}` : 'Joker'
}

/** Accessible name, such as "7 of hearts" or "Joker". */
export function cardName(card: Card): string {
  return card.suit ? `${RANK_NAMES[card.rank]} of ${card.suit}` : 'Joker'
}

export function sortHand(cards: readonly Card[]): Card[] {
  const suitIndex = (c: Card) => (c.suit ? SUIT_ORDER.indexOf(c.suit) : -1)
  return [...cards].sort(
    (a, b) => rankIndex(a.rank) - rankIndex(b.rank) || suitIndex(a) - suitIndex(b) || a.id - b.id,
  )
}
