import type { Card, Meld, Phase, PlayerView, Rank, Suit } from '@canasta/engine'

const SUITS: Record<string, Suit> = { c: 'clubs', d: 'diamonds', h: 'hearts', s: 'spades' }

/** 'Kh' → king of hearts, 'JK' → joker, with the id you choose. */
export function card(code: string, id: number): Card {
  if (code === 'JK') return { id, rank: 'JOKER', suit: null }
  return { id, rank: code.slice(0, -1) as Rank, suit: SUITS[code.slice(-1)] }
}

/** A two-player view where it is your turn ("you" sits first). */
export function makeView(opts: {
  hand: Card[]
  phase: Phase
  melds?: Meld[]
  top?: Card | null
  score?: number
  turnsThisRound?: number
  hasPickedUpPile?: boolean
}): PlayerView {
  const melds = opts.melds ?? []
  const you = {
    id: 'you',
    name: 'You',
    score: opts.score ?? 0,
    hand: opts.hand,
    melds,
    red3s: [],
    hasPickedUpPile: opts.hasPickedUpPile ?? false,
    turnsThisRound: opts.turnsThisRound ?? 2,
    meldedBeforeThisTurn: melds.length > 0,
    drawnCard: null,
  }
  const top = opts.top === undefined ? card('Kc', 900) : opts.top
  return {
    you,
    players: [
      {
        id: 'you',
        name: 'You',
        score: you.score,
        handCount: opts.hand.length,
        melds,
        red3s: [],
        turnsThisRound: you.turnsThisRound,
      },
      { id: 'bob', name: 'Bob', score: 0, handCount: 13, melds: [], red3s: [], turnsThisRound: 1 },
    ],
    round: {
      number: 1,
      dealer: 1,
      current: 0,
      phase: opts.phase,
      stockCount: 40,
      discardTop: top,
      discardCount: top ? 3 : 0,
      pileFrozenForAll: false,
      frozenBy: null,
      feed: [],
    },
    history: [],
    status: 'playing',
    winners: [],
    quit: [],
  }
}
