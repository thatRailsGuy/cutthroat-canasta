import { STANDARD_RANKS, SUITS, type Card } from './cards'

export function buildDeck(decks: number): Card[] {
  const cards: Card[] = []
  for (let d = 0; d < decks; d++) {
    for (const suit of SUITS) {
      for (const rank of STANDARD_RANKS) cards.push({ id: cards.length, rank, suit })
    }
    cards.push({ id: cards.length, rank: 'JOKER', suit: null })
    cards.push({ id: cards.length, rank: 'JOKER', suit: null })
  }
  return cards
}
