import { isRed3, isWild } from './cards'
import { WINNING_SCORE, deckCount, handSize } from './constants'
import { buildDeck } from './deck'
import { createRng, shuffle, type Seed } from './rng'
import { scoreRound } from './scoring'
import type { Game } from './types'

// The helpers below mutate `game`. Only call them on a copy made with cloneGame.

export function dealRound(game: Game, number: number, dealer: number, redeals = 0): void {
  const n = game.players.length
  const stock = shuffle(buildDeck(deckCount(n)), createRng(roundSeed(game.seed, number, redeals)))
  const size = handSize(n)

  for (const player of game.players) {
    player.hand = stock.splice(stock.length - size, size)
    player.melds = []
    player.red3s = []
    player.hasPickedUpPile = false
    player.turnsThisRound = 0
    player.meldedBeforeThisTurn = false
    player.drawnCard = null
  }
  for (const player of game.players) {
    for (let i = player.hand.findIndex(isRed3); i !== -1; i = player.hand.findIndex(isRed3)) {
      player.red3s.push(...player.hand.splice(i, 1))
      player.hand.push(stock.pop()!)
    }
  }

  // A wild or Red 3 upcard stays in the pile and freezes it for everyone.
  const upcard = stock.pop()!
  const frozenBy = isRed3(upcard) || isWild(upcard) ? upcard : null

  game.round = {
    number,
    dealer,
    current: (dealer + 1) % n,
    stock,
    discard: [upcard],
    pileFrozenForAll: frozenBy !== null,
    frozenBy,
    phase: 'draw',
    nextMeldId: 0,
    feed: [],
    redeals,
  }
  game.status = 'playing'
  beginTurn(game)
}

/**
 * Mixes the round number and the redeal count into the seed, so no two deals of a game share a
 * shuffle. With no redeals the seed is the same as before redeals existed.
 */
function roundSeed([a, b, c, d]: Seed, round: number, redeals: number): Seed {
  return [
    (a ^ Math.imul(round, 0x9e3779b9)) >>> 0,
    redeals === 0 ? b : (b ^ Math.imul(redeals, 0x85ebca6b)) >>> 0,
    c,
    d,
  ]
}

export function beginTurn(game: Game): void {
  const round = game.round!
  const player = game.players[round.current]
  player.turnsThisRound += 1
  player.meldedBeforeThisTurn = player.melds.length > 0
  round.phase = 'draw'
}

export function advanceTurn(game: Game): void {
  const round = game.round!
  game.players[round.current].drawnCard = null
  round.current = (round.current + 1) % game.players.length
  beginTurn(game)
}

export function endRound(game: Game, wentOut: string | null): void {
  const breakdown = scoreRound(game.players, wentOut)
  for (const player of game.players) player.score += breakdown[player.id].total
  game.history.push({
    round: game.round!.number,
    endedBy: wentOut ? 'goingOut' : 'stockOut',
    wentOut,
    breakdown,
    hands: Object.fromEntries(game.players.map((p) => [p.id, [...p.hand]])),
  })
  const best = Math.max(...game.players.map((p) => p.score))
  if (best >= WINNING_SCORE) {
    game.status = 'gameOver'
    game.winners = game.players.filter((p) => p.score === best).map((p) => p.id)
  } else {
    game.status = 'roundOver'
  }
}
