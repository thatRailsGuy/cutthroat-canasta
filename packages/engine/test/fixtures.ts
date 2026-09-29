import type { Card, Rank, Suit } from '../src/cards'
import type { Game, GameResult, Meld, Player, Round } from '../src/types'
import { addPlayer, createGame } from '../src/game'
import type { Seed } from '../src/rng'

const SUIT_CODES: Record<string, Suit> = { c: 'clubs', d: 'diamonds', h: 'hearts', s: 'spades' }
let nextCardId = 10_000
let nextMeldId = 0

/** 'Kh' → king of hearts, '10s' → ten of spades, 'JK' → joker. Every call gets a fresh id. */
export function card(code: string): Card {
  if (code === 'JK') return { id: nextCardId++, rank: 'JOKER', suit: null }
  const suit = SUIT_CODES[code.slice(-1)]
  if (!suit) throw new Error(`Bad card code: ${code}`)
  return { id: nextCardId++, rank: code.slice(0, -1) as Rank, suit }
}

export function cards(codes: string): Card[] {
  const trimmed = codes.trim()
  return trimmed === '' ? [] : trimmed.split(/\s+/).map(card)
}

export function ids(list: Card[]): number[] {
  return list.map((c) => c.id)
}

export function meld(codes: string): Meld {
  const list = cards(codes)
  const natural = list.find((c) => c.rank !== '2' && c.rank !== 'JOKER')
  if (!natural) throw new Error(`Meld needs a natural card: ${codes}`)
  return { id: `fx${nextMeldId++}`, rank: natural.rank as Meld['rank'], cards: list }
}

/** Defaults to a player on their second turn, so going out is allowed unless overridden. */
export function makePlayer(overrides: Partial<Player> & { id: string }): Player {
  const melds = overrides.melds ?? []
  return {
    name: overrides.id,
    score: 0,
    hand: [],
    red3s: [],
    hasPickedUpPile: false,
    turnsThisRound: 2,
    meldedBeforeThisTurn: melds.length > 0,
    ...overrides,
    melds,
  }
}

export function makeGame(opts: {
  players: Player[]
  stock?: Card[]
  discard?: Card[]
  current?: number
  phase?: Round['phase']
  pileFrozenForAll?: boolean
}): Game {
  return {
    players: opts.players,
    round: {
      number: 1,
      dealer: 0,
      current: opts.current ?? 0,
      stock: opts.stock ?? cards('4c 5c 6c 7c 8c 9c'),
      discard: opts.discard ?? cards('Kc'),
      pileFrozenForAll: opts.pileFrozenForAll ?? false,
      phase: opts.phase ?? 'play',
      nextMeldId: 100,
      feed: [],
    },
    history: [],
    status: 'playing',
    seed: seedOf(1),
    log: [],
    winners: [],
  }
}

export function unwrap(result: GameResult): Game {
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
  return result.game
}

/** Expands a small test number into a full 128-bit seed. */
export function seedOf(n: number): Seed {
  return [n >>> 0, 0x9e3779b9, 0x243f6a88, 0xb7e15162]
}

export function lobby(players: number, seed = 42): Game {
  let game = createGame(seedOf(seed))
  for (let i = 0; i < players; i++) game = unwrap(addPlayer(game, `p${i}`, `Player ${i}`))
  return game
}

export function allCardIds(game: Game): number[] {
  const round = game.round!
  return [
    ...round.stock,
    ...round.discard,
    ...game.players.flatMap((p) => [...p.hand, ...p.red3s, ...p.melds.flatMap((m) => m.cards)]),
  ].map((c) => c.id)
}

export function countCards(game: Game): number {
  return allCardIds(game).length
}

/** Every card id reachable anywhere inside a value (anything shaped like a Card). */
export function visibleCardIds(value: unknown): number[] {
  const found: number[] = []
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === 'object') {
      const record = v as Record<string, unknown>
      if (typeof record.id === 'number' && typeof record.rank === 'string') found.push(record.id)
      Object.values(record).forEach(walk)
    }
  }
  walk(value)
  return found
}
