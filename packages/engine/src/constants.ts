import type { Card, Rank } from './cards'

export const CARD_VALUES: Record<Rank, number> = {
  JOKER: 50,
  '2': 20,
  A: 20,
  K: 10,
  Q: 10,
  J: 10,
  '10': 10,
  '9': 10,
  '8': 10,
  '7': 5,
  '6': 5,
  '5': 5,
  '4': 5,
  '3': 5,
}

export const RED_THREE_BONUS = 100
export const CLEAN_CANASTA_BONUS = 500
export const DIRTY_CANASTA_BONUS = 300
export const GOING_OUT_BONUS = 100
export const CONCEALED_HAND_BONUS = 200
export const WINNING_SCORE = 5000
export const MIN_MELD_SIZE = 3
export const CANASTA_SIZE = 7
export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 8

/** Scores below `below` need `minimum` points; `below: null` is the top tier. */
export interface InitialMeldTier {
  below: number | null
  minimum: number
}

export const INITIAL_MELD_TIERS: InitialMeldTier[] = [
  { below: 0, minimum: 15 },
  { below: 1500, minimum: 50 },
  { below: 3000, minimum: 90 },
  { below: null, minimum: 120 },
]

export function cardValue(card: Card): number {
  return CARD_VALUES[card.rank]
}

export function deckCount(players: number): number {
  return Math.max(2, Math.ceil(players / 2))
}

export function handSize(players: number): number {
  return players === 2 ? 15 : 13
}

export function initialMeldMinimum(score: number): number {
  const tier = INITIAL_MELD_TIERS.find((t) => t.below === null || score < t.below)
  return tier!.minimum
}
