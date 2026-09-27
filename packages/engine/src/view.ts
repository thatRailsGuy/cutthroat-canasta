import type { Card } from './cards'
import type { Game, GameStatus, Meld, Phase, Player, RoundScore } from './types'

export interface PublicPlayer {
  id: string
  name: string
  score: number
  handCount: number
  melds: Meld[]
  red3s: Card[]
  turnsThisRound: number
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
}

export interface PlayerView {
  you: Player | null
  players: PublicPlayer[]
  round: RoundView | null
  history: RoundScore[]
  status: GameStatus
  winners: string[]
}

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
        }
      : null,
    history: game.history,
    status: game.status,
    winners: game.winners,
  }
}
