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
  /** The card drawn from the stock this turn, so the client can point it out. */
  drawnCard: CardId | null
}

export type Phase = 'draw' | 'play'

export interface Round {
  number: number
  dealer: number
  current: number
  stock: Card[]
  /** Last element is the top of the pile. */
  discard: Card[]
  /** A wild or Red 3 upcard, or a discarded wild, froze the pile; cleared when it is picked up. */
  pileFrozenForAll: boolean
  /** The card that froze the pile for everyone (the first, if several did), or null. */
  frozenBy: Card | null
  phase: Phase
  nextMeldId: number
  /** Public events this round, oldest first. Every card in it was face up at the time. */
  feed: FeedEvent[]
  /** How many times the host threw this round's hand out and dealt again. */
  redeals?: number
}

/** Cards a play put on the table. */
export interface Played {
  newMelds: Card[][]
  additions: { meldId: string; cards: Card[] }[]
}

/** A meld that a play made into a canasta. */
export interface CompletedCanasta {
  rank: NaturalRank
  natural: boolean
}

export type FeedEvent =
  | { type: 'drewStock'; playerId: string; red3s: Card[] }
  /**
   * `count` is the whole pile, including the top card that went into a meld. `red3s` are Red 3s
   * that were in the pile (a Red 3 upcard); they are laid down, not taken into the hand.
   */
  | {
      type: 'pickedUpPile'
      playerId: string
      count: number
      played: Played
      canastas: CompletedCanasta[]
      red3s: Card[]
    }
  | { type: 'melded'; playerId: string; played: Played; canastas: CompletedCanasta[] }
  | { type: 'discarded'; playerId: string; card: Card }
  | { type: 'wentOut'; playerId: string }
  | { type: 'stockOut' }
  /** The player left the game for good. The name is kept, since they are no longer seated. */
  | { type: 'quit'; playerId: string; name: string }
  /** The host threw out the hand and dealt a new one. Nobody scores the old one. */
  | { type: 'redealt'; playerId: string }
  /** Someone joined mid-game. They are not seated yet, so the name is sent too. */
  | { type: 'joined'; playerId: string; name: string }

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
  /** Every player's hand when the round ended, so the scoreboard can show it later. */
  hands: Record<string, Card[]>
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
  | { playerId: string; action: Action }
  | { event: 'startGame' }
  | { event: 'startNextRound' }
  | { event: 'quit'; playerId: string }
  | { event: 'redeal'; playerId: string }
  | { event: 'join'; playerId: string }
  | { event: 'restart' }
  | { event: 'leave'; playerId: string }

/** A player who quit a started game. Their past rounds stay in `history`. */
export interface QuitPlayer {
  id: string
  name: string
  /** Their total when they quit. */
  score: number
  /** The round they quit in. */
  round: number
}

export interface Game {
  players: Player[]
  round: Round | null
  history: RoundScore[]
  status: GameStatus
  seed: Seed
  log: LogEntry[]
  winners: string[]
  /** Players who quit, in the order they quit. */
  quit: QuitPlayer[]
  /**
   * Players who joined after the game started, in join order. They sit out the hand being
   * played and take the next seats when a new hand is dealt.
   */
  waiting?: Player[]
  /** Which game this is at the table: 1 for the first, one more after each Play again. */
  number?: number
  /** Who deals round 1. Play again sets it to the player after the last game's last dealer. */
  firstDealer?: string
  /**
   * Players who left after the game ended, in the order they left. They stay in `players`, so
   * the final standings don't change, and Play again leaves them out.
   */
  left?: string[]
}

export type GameResult = { ok: true; game: Game } | { ok: false; error: RuleError }
