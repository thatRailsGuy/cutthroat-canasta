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

/**
 * Seats a player. In the lobby they sit down at once. Once the game has started they wait, sitting
 * out the hand being played, and are dealt in with the next hand.
 */
export function addPlayer(game: Game, id: string, name: string): GameResult {
  if (game.status === 'gameOver') {
    return fail('NOT_IN_LOBBY', 'This game is over. Start a new one to play.')
  }
  // `?? []`: games saved before mid-game joining existed.
  const everyone = [...game.players, ...(game.waiting ?? [])]
  if (everyone.length >= MAX_PLAYERS) {
    return fail('TABLE_FULL', `The table is full (${MAX_PLAYERS} players).`)
  }
  if (everyone.some((p) => p.id === id)) {
    return fail('DUPLICATE_PLAYER', 'That player is already at the table.')
  }
  if (everyone.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    return fail('NAME_TAKEN', `Someone at the table is already called ${name}.`)
  }
  const next = cloneGame(game)
  const seats = game.status === 'lobby' ? next.players : (next.waiting ??= [])
  seats.push({
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
  if (game.status !== 'lobby') {
    next.round?.feed.push({ type: 'joined', playerId: id, name })
    next.log.push({ event: 'join', playerId: id })
  }
  return { ok: true, game: next }
}

/** Players who joined mid-game take the next seats, after everyone already playing. */
function seatWaiting(game: Game): void {
  game.players.push(...(game.waiting ?? []))
  game.waiting = []
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
  seatWaiting(next)
  dealRound(next, previous.number + 1, (previous.dealer + 1) % next.players.length)
  next.log.push({ event: 'startNextRound' })
  return { ok: true, game: next }
}

/**
 * Throws out the hand being played and deals it again: the same round, the same dealer, a new
 * shuffle. Nobody scores the old hand. The room lets only the host do this.
 */
export function redealRound(game: Game, playerId: string): GameResult {
  if (game.status !== 'playing' || !game.round) {
    return fail('GAME_NOT_PLAYING', 'You can only deal a new hand while a round is being played.')
  }
  const next = cloneGame(game)
  const previous = next.round!
  // A fresh deal, so anyone waiting for a seat is dealt in now.
  seatWaiting(next)
  dealRound(next, previous.number, previous.dealer, (previous.redeals ?? 0) + 1)
  next.round!.feed.push({ type: 'redealt', playerId })
  next.log.push({ event: 'redeal', playerId })
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
  const next = cloneGame(game)
  const waiting = next.waiting?.findIndex((p) => p.id === id) ?? -1
  if (waiting !== -1) {
    // Never dealt in, so there is nothing to score or close up.
    const [gone] = next.waiting!.splice(waiting, 1)
    next.round?.feed.push({ type: 'quit', playerId: id, name: gone.name })
    next.log.push({ event: 'quit', playerId: id })
    return { ok: true, game: next }
  }
  const seat = game.players.findIndex((p) => p.id === id)
  if (seat === -1) throw new Error(`Unknown player: ${id}`)
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
