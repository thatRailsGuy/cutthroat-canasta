import { describe, expect, it } from 'vitest'
import {
  applyAction,
  createRng,
  deckCount,
  isNatural,
  legalityPreview,
  shuffle,
  startGame,
  startNextRound,
  viewFor,
  type Action,
  type Card,
  type Game,
  type Rng,
} from '../src'
import { allCardIds, countCards, lobby, seedOf, unwrap, visibleCardIds } from './fixtures'

const SEEDS = 30
const MAX_ROUNDS = 4
const MAX_TURNS_PER_ROUND = 5000

/** Applies the action only if the preview says it's legal; the engine must then agree. */
function tryAction(game: Game, playerId: string, action: Action): Game | null {
  if (legalityPreview(viewFor(game, playerId), action)) return null
  return unwrap(applyAction(game, playerId, action))
}

function naturalsByRank(hand: Card[]): Map<string, Card[]> {
  const groups = new Map<string, Card[]>()
  for (const c of hand.filter(isNatural)) groups.set(c.rank, [...(groups.get(c.rank) ?? []), c])
  return groups
}

function takeTurn(game: Game, rng: Rng): Game {
  const seat = game.round!.current
  const player = game.players[seat]
  const top = game.round!.discard.at(-1)
  const pair = top ? (naturalsByRank(player.hand).get(top.rank) ?? []).slice(0, 2) : []
  const picked =
    top && pair.length === 2
      ? tryAction(game, player.id, {
          type: 'pickUpPile',
          play: { newMelds: [[top.id, ...pair.map((c) => c.id)]], additions: [] },
        })
      : null
  let g = picked ?? unwrap(applyAction(game, player.id, { type: 'drawStock' }))
  if (g.status !== 'playing') return g

  // An initial meld usually needs several melds together to reach the minimum.
  if (g.players[seat].melds.length === 0) {
    const newMelds = [...naturalsByRank(g.players[seat].hand).values()]
      .filter((group) => group.length >= 3)
      .map((group) => group.map((c) => c.id))
    if (newMelds.length > 0) {
      g = tryAction(g, player.id, { type: 'meld', play: { newMelds, additions: [] } }) ?? g
      if (g.status !== 'playing') return g
    }
  }

  for (const [rank, group] of naturalsByRank(g.players[seat].hand)) {
    const me = g.players[seat]
    const existing = me.melds.find((m) => m.rank === rank)
    const play = existing
      ? { newMelds: [], additions: [{ meldId: existing.id, cardIds: group.map((c) => c.id) }] }
      : group.length >= 3
        ? { newMelds: [group.map((c) => c.id)], additions: [] }
        : null
    if (!play) continue
    const next = tryAction(g, me.id, { type: 'meld', play })
    if (next) {
      g = next
      if (g.status !== 'playing') return g
    }
  }

  const me = g.players[seat]
  for (const c of shuffle(me.hand, rng)) {
    const next = tryAction(g, me.id, { type: 'discard', cardId: c.id })
    if (next) return next
  }
  throw new Error(`Player ${me.id} has no legal discard: ${JSON.stringify(me.hand)}`)
}

/** Records every card that is face up now: the top discard, melds and Red 3s. */
function markFaceUp(game: Game, faceUp: Set<number>): void {
  const top = game.round!.discard.at(-1)
  if (top) faceUp.add(top.id)
  for (const p of game.players) {
    for (const c of [...p.red3s, ...p.melds.flatMap((m) => m.cards)]) faceUp.add(c.id)
  }
}

function checkInvariants(game: Game, totalCards: number, faceUp: Set<number>): void {
  const round = game.round!
  expect(countCards(game)).toBe(totalCards)
  const allIds = allCardIds(game)
  expect(new Set(allIds).size).toBe(allIds.length)

  if (game.status === 'playing') {
    for (const viewer of game.players) {
      // The feed may show any card that was face up this round, even after a pickup took it.
      const secret = new Set(
        [
          ...game.players.filter((p) => p.id !== viewer.id).flatMap((p) => p.hand),
          ...round.stock,
          ...round.discard.slice(0, -1),
        ]
          .map((c) => c.id)
          .filter((id) => !faceUp.has(id)),
      )
      const leaked = visibleCardIds(viewFor(game, viewer.id)).filter((id) => secret.has(id))
      expect(leaked).toEqual([])
    }
  } else {
    // At round end every hand is revealed, and the stock stays hidden.
    const view = viewFor(game, game.players[0].id)
    expect(view.players.map((p) => p.revealedHand)).toEqual(game.players.map((p) => p.hand))
    const stock = new Set(round.stock.map((c) => c.id))
    expect(visibleCardIds(view).filter((id) => stock.has(id))).toEqual([])
  }

  for (const entry of game.history) {
    for (const b of Object.values(entry.breakdown)) {
      expect(b.total).toBe(
        b.meldPoints +
          b.canastaBonus +
          b.red3Points +
          b.goingOutBonus +
          b.concealedBonus -
          b.handPenalty,
      )
    }
  }
}

describe('random games', () => {
  it.each(Array.from({ length: SEEDS }, (_, i) => i + 1))(
    'seed %i keeps every invariant',
    (seed) => {
      const players = 2 + (seed % 7)
      const totalCards = deckCount(players) * 54
      const rng = createRng(seedOf(seed))
      let game = unwrap(startGame(lobby(players, seed)))

      for (let round = 0; round < MAX_ROUNDS && game.status !== 'gameOver'; round++) {
        const faceUp = new Set<number>()
        markFaceUp(game, faceUp)
        for (let turns = 0; game.status === 'playing'; turns++) {
          if (turns > MAX_TURNS_PER_ROUND) throw new Error('Round never ended')
          game = takeTurn(game, rng)
          markFaceUp(game, faceUp)
          checkInvariants(game, totalCards, faceUp)
        }
        if (game.status === 'roundOver') game = unwrap(startNextRound(game))
      }
      // The server stores the whole game in a single 2 MB Durable Object value.
      expect(JSON.stringify(game).length).toBeLessThan(1_000_000)
    },
  )
})
