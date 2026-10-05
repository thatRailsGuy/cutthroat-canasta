import type { Card } from './cards'
import type {
  FeedEvent,
  Game,
  GameStatus,
  Meld,
  Phase,
  Player,
  QuitPlayer,
  RoundScore,
} from './types'

export interface PublicPlayer {
  id: string
  name: string
  score: number
  handCount: number
  melds: Meld[]
  red3s: Card[]
  turnsThisRound: number
  /** Until a player's first pickup of the round, the pile is frozen for them. */
  hasPickedUpPile: boolean
}

export interface RoundView {
  number: number
  dealer: number
  current: number
  phase: Phase
  stockCount: number
  discardTop: Card | null
  discardCount: number
  pileFrozenForAll: boolean
  /** The card that froze the pile for everyone. It is face up, sideways under the pile. */
  frozenBy: Card | null
  feed: FeedEvent[]
  /** How many times this round's hand was thrown out and dealt again. */
  redeals: number
}

export interface PlayerView {
  you: Player | null
  players: PublicPlayer[]
  round: RoundView | null
  history: RoundScore[]
  status: GameStatus
  winners: string[]
  quit: QuitPlayer[]
  /** Players who joined mid-game and are dealt in with the next hand. */
  waiting: { id: string; name: string }[]
}

/**
 * Builds the per-player view of a game. The returned objects (players, melds, cards,
 * history, etc.) are shared references into the `Game`, not copies — callers must treat
 * this as read-only and serialize it before sending it anywhere (e.g. over the network).
 */
export function viewFor(game: Game, playerId: string): PlayerView {
  const round = game.round
  return {
    you: game.players.find((p) => p.id === playerId) ?? null,
    players: game.players.map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      handCount: p.hand.length,
      melds: p.melds,
      red3s: p.red3s,
      turnsThisRound: p.turnsThisRound,
      hasPickedUpPile: p.hasPickedUpPile,
    })),
    round: round
      ? {
          number: round.number,
          dealer: round.dealer,
          current: round.current,
          phase: round.phase,
          stockCount: round.stock.length,
          discardTop: round.discard.at(-1) ?? null,
          discardCount: round.discard.length,
          pileFrozenForAll: round.pileFrozenForAll,
          // `?? null`: rounds saved before `frozenBy` existed.
          frozenBy: round.frozenBy ?? null,
          feed: round.feed,
          // `?? 0`: rounds saved before redeals existed.
          redeals: round.redeals ?? 0,
        }
      : null,
    history: game.history,
    status: game.status,
    winners: game.winners,
    // `?? []`: games saved before quitting existed.
    quit: game.quit ?? [],
    // `?? []`: games saved before mid-game joining existed.
    waiting: (game.waiting ?? []).map((p) => ({ id: p.id, name: p.name })),
  }
}
