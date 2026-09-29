import type { Card } from './cards'
import type { FeedEvent, Game, GameStatus, Meld, Phase, Player, RoundScore } from './types'

export interface PublicPlayer {
  id: string
  name: string
  score: number
  handCount: number
  melds: Meld[]
  red3s: Card[]
  turnsThisRound: number
  /** Everyone's hand once the round is over, so players can check the scoring; otherwise null. */
  revealedHand: Card[] | null
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
  feed: FeedEvent[]
}

export interface PlayerView {
  you: Player | null
  players: PublicPlayer[]
  round: RoundView | null
  history: RoundScore[]
  status: GameStatus
  winners: string[]
}

/**
 * Builds the per-player view of a game. The returned objects (players, melds, cards,
 * history, etc.) are shared references into the `Game`, not copies — callers must treat
 * this as read-only and serialize it before sending it anywhere (e.g. over the network).
 */
export function viewFor(game: Game, playerId: string): PlayerView {
  const round = game.round
  const revealed = game.status === 'roundOver' || game.status === 'gameOver'
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
      revealedHand: revealed ? p.hand : null,
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
          feed: round.feed,
        }
      : null,
    history: game.history,
    status: game.status,
    winners: game.winners,
  }
}
