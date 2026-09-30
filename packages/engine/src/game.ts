import { cloneGame } from './clone'
import { MAX_PLAYERS, MIN_PLAYERS } from './constants'
import { ruleError, type RuleErrorCode } from './errors'
import type { Seed } from './rng'
import { beginTurn, dealRound } from './round'
import type { Game, GameResult } from './types'

const fail = (code: RuleErrorCode, message: string): GameResult => ({
  ok: false,
  error: ruleError(code, message),
})

export function createGame(seed: Seed): Game {
  return {
    players: [],
    round: null,
    history: [],
    status: 'lobby',
    seed,
    log: [],
    winners: [],
    quit: [],
  }
}

export function addPlayer(game: Game, id: string, name: string): GameResult {
  if (game.status !== 'lobby') {
    return fail('NOT_IN_LOBBY', 'Players can only join before the game starts.')
  }
  if (game.players.length >= MAX_PLAYERS) {
    return fail('TABLE_FULL', `The table is full (${MAX_PLAYERS} players).`)
  }
  if (game.players.some((p) => p.id === id)) {
    return fail('DUPLICATE_PLAYER', 'That player is already at the table.')
  }
  if (game.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    return fail('NAME_TAKEN', `Someone at the table is already called ${name}.`)
  }
  const next = cloneGame(game)
  next.players.push({
    id,
    name,
    score: 0,
    hand: [],
    melds: [],
    red3s: [],
    hasPickedUpPile: false,
    turnsThisRound: 0,
    meldedBeforeThisTurn: false,
    drawnCard: null,
  })
  return { ok: true, game: next }
}

/** Lobby only. Throws for an unknown id: callers check the seat exists. */
export function removePlayer(game: Game, id: string): GameResult {
  if (game.status !== 'lobby') {
    return fail('NOT_IN_LOBBY', 'Seats can only be given up or removed before the game starts.')
  }
  if (!game.players.some((p) => p.id === id)) throw new Error(`Unknown player: ${id}`)
  const next = cloneGame(game)
  next.players = next.players.filter((p) => p.id !== id)
  return { ok: true, game: next }
}

export function startGame(game: Game): GameResult {
  if (game.status !== 'lobby') return fail('NOT_IN_LOBBY', 'The game has already started.')
  if (game.players.length < MIN_PLAYERS) {
    return fail('NOT_ENOUGH_PLAYERS', `You need at least ${MIN_PLAYERS} players to start.`)
  }
  const next = cloneGame(game)
  dealRound(next, 1, 0)
  next.log.push({ event: 'startGame' })
  return { ok: true, game: next }
}

export function startNextRound(game: Game): GameResult {
  if (game.status !== 'roundOver' || !game.round) {
    return fail('ROUND_NOT_OVER', 'The next round can only start after this one is scored.')
  }
  const next = cloneGame(game)
  const previous = next.round!
  dealRound(next, previous.number + 1, (previous.dealer + 1) % next.players.length)
  next.log.push({ event: 'startNextRound' })
  return { ok: true, game: next }
}

/**
 * A player leaves a started game for good. Their hand and melds leave play and are not scored;
 * their past rounds stay in `history`. The turn order and the dealer seat close up. If it was
 * their turn, the next player starts at the draw. When only one player is left, they win.
 * Throws for an unknown id: callers check the seat exists.
 */
export function quitGame(game: Game, id: string): GameResult {
  if (game.status !== 'playing' && game.status !== 'roundOver') {
    return fail('GAME_NOT_PLAYING', 'You can only quit a game that is in progress.')
  }
  const seat = game.players.findIndex((p) => p.id === id)
  if (seat === -1) throw new Error(`Unknown player: ${id}`)
  const next = cloneGame(game)
  const [gone] = next.players.splice(seat, 1)
  const round = next.round!
  // `?? []`: games saved before quitting existed.
  next.quit = [
    ...(next.quit ?? []),
    { id, name: gone.name, score: gone.score, round: round.number },
  ]
  next.log.push({ event: 'quit', playerId: id })
  round.feed.push({ type: 'quit', playerId: id, name: gone.name })

  const n = next.players.length
  // The seat after the dealer deals next, so a quitting dealer passes the deal to that seat.
  if (seat <= round.dealer) round.dealer = (round.dealer - 1 + n) % n
  if (seat < round.current) {
    round.current -= 1
  } else if (seat === round.current) {
    round.current = seat % n
    if (next.status === 'playing') beginTurn(next)
  }

  if (n === 1) {
    next.status = 'gameOver'
    next.winners = [next.players[0].id]
  }
  return { ok: true, game: next }
}
