export const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'] as const
export type Suit = (typeof SUITS)[number]

export const STANDARD_RANKS = [
  'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K',
] as const
export type Rank = (typeof STANDARD_RANKS)[number] | 'JOKER'
export type NaturalRank = Exclude<Rank, '2' | '3' | 'JOKER'>

export type CardId = number

export interface Card {
  id: CardId
  rank: Rank
  suit: Suit | null
}

export function isWild(card: Card): boolean {
  return card.rank === '2' || card.rank === 'JOKER'
}

export function isRed3(card: Card): boolean {
  return card.rank === '3' && (card.suit === 'hearts' || card.suit === 'diamonds')
}

export function isBlack3(card: Card): boolean {
  return card.rank === '3' && (card.suit === 'clubs' || card.suit === 'spades')
}

export function isNatural(card: Card): boolean {
  return !isWild(card) && card.rank !== '3'
}
