import type { Card, CardId, NaturalRank } from './cards'
import type { RuleError } from './errors'
import type { Seed } from './rng'

export interface Meld {
  id: string
  rank: NaturalRank
  cards: Card[]
}

export interface Player {
  id: string
  name: string
  /** Cumulative across rounds; updated only when a round ends. */
  score: number
  hand: Card[]
  melds: Meld[]
  red3s: Card[]
  /** Lifts the personal freeze for the rest of the round. */
  hasPickedUpPile: boolean
  /** Incremented when the player's turn begins; 1 during their first turn. */
  turnsThisRound: number
  /** Whether the player had any melds when their current turn began (concealed hand bonus). */
  meldedBeforeThisTurn: boolean
}

export type Phase = 'draw' | 'play'

export interface Round {
  number: number
  dealer: number
  current: number
  stock: Card[]
  /** Last element is the top of the pile. */
  discard: Card[]
  /** A wild was buried as the upcard or discarded; cleared when the pile is picked up. */
  pileFrozenForAll: boolean
  phase: Phase
  nextMeldId: number
  /** Public events this round, oldest first. Every card in it was face up at the time. */
  feed: FeedEvent[]
}

/** Cards a play put on the table. */
export interface Played {
  newMelds: Card[][]
  additions: { meldId: string; cards: Card[] }[]
}

export type FeedEvent =
  | { type: 'drewStock'; playerId: string; red3s: Card[] }
  /** `count` is the whole pile, including the top card that went into a meld. */
  | { type: 'pickedUpPile'; playerId: string; count: number; played: Played }
  | { type: 'melded'; playerId: string; played: Played }
  | { type: 'discarded'; playerId: string; card: Card }
  | { type: 'wentOut'; playerId: string }
  | { type: 'stockOut' }

export interface ScoreBreakdown {
  meldPoints: number
  canastaBonus: number
  red3Points: number
  goingOutBonus: number
  concealedBonus: number
  /** Positive number that is subtracted. */
  handPenalty: number
  total: number
}

export interface RoundScore {
  round: number
  endedBy: 'goingOut' | 'stockOut'
  wentOut: string | null
  breakdown: Record<string, ScoreBreakdown>
}

export type GameStatus = 'lobby' | 'playing' | 'roundOver' | 'gameOver'

export interface MeldBatch {
  newMelds: CardId[][]
  additions: { meldId: string; cardIds: CardId[] }[]
}

export type Action =
  | { type: 'drawStock' }
  | { type: 'pickUpPile'; play: MeldBatch }
  | { type: 'meld'; play: MeldBatch }
  | { type: 'discard'; cardId: CardId }

export type LogEntry =
  { playerId: string; action: Action } | { event: 'startGame' } | { event: 'startNextRound' }

export interface Game {
  players: Player[]
  round: Round | null
  history: RoundScore[]
  status: GameStatus
  seed: Seed
  log: LogEntry[]
  winners: string[]
}

export type GameResult = { ok: true; game: Game } | { ok: false; error: RuleError }
