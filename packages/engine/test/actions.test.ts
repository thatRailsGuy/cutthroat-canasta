import { describe, expect, it } from 'vitest'
import { applyAction } from '../src/actions'
import type { Action, Game } from '../src/types'
import { cards, ids, makeGame, makePlayer, meld, unwrap } from './fixtures'

const errorCode = (game: Game, playerId: string, action: Action) => {
  const result = applyAction(game, playerId, action)
  return result.ok ? null : result.error.code
}
const canastaOf5s = () => meld('5h 5d 5s 5c 5h 5d 5s')
const twoPlayers = (
  a: Parameters<typeof makePlayer>[0],
  b: Parameters<typeof makePlayer>[0] = { id: 'b', hand: cards('Kh Kd') },
) => [makePlayer(a), makePlayer(b)]

describe('turn order and phases', () => {
  it('throws on an unknown action type', () => {
    const game = makeGame({ players: twoPlayers({ id: 'a', hand: cards('4c 5c') }) })
    expect(() => applyAction(game, 'a', { type: 'bogus' } as unknown as Action)).toThrow(
      'Unknown action type',
    )
  })

  it("rejects actions when it isn't your turn", () => {
    const game = makeGame({ players: twoPlayers({ id: 'a', hand: cards('4c 5c') }) })
    expect(errorCode(game, 'b', { type: 'discard', cardId: game.players[1].hand[0].id })).toBe(
      'NOT_YOUR_TURN',
    )
  })

  it('rejects actions when no round is in progress', () => {
    const game = makeGame({ players: twoPlayers({ id: 'a', hand: cards('4c 5c') }) })
    game.status = 'roundOver'
    expect(errorCode(game, 'a', { type: 'drawStock' })).toBe('GAME_NOT_PLAYING')
  })

  it('rejects drawing twice', () => {
    const game = makeGame({ players: twoPlayers({ id: 'a', hand: cards('4c 5c') }), phase: 'play' })
    expect(errorCode(game, 'a', { type: 'drawStock' })).toBe('WRONG_PHASE')
  })

  it('does not modify the game it was given, and logs the action', () => {
    const game = makeGame({ players: twoPlayers({ id: 'a', hand: cards('4c 5c') }), phase: 'draw' })
    const before = JSON.stringify(game)
    const next = unwrap(applyAction(game, 'a', { type: 'drawStock' }))
    expect(JSON.stringify(game)).toBe(before)
    expect(next.log).toEqual([{ playerId: 'a', action: { type: 'drawStock' } }])
  })
})

describe('drawStock', () => {
  it('moves the top of the stock into hand and starts the play phase', () => {
    const stock = cards('9c Kd')
    const game = makeGame({
      players: twoPlayers({ id: 'a', hand: cards('4c') }),
      stock,
      phase: 'draw',
    })
    const next = unwrap(applyAction(game, 'a', { type: 'drawStock' }))
    expect(ids(next.players[0].hand)).toContain(stock[1].id)
    expect(next.round!.stock).toHaveLength(1)
    expect(next.round!.phase).toBe('play')
  })

  it('lays out a drawn red 3 and draws a replacement', () => {
    const stock = cards('9c 3h')
    const game = makeGame({
      players: twoPlayers({ id: 'a', hand: cards('4c') }),
      stock,
      phase: 'draw',
    })
    const next = unwrap(applyAction(game, 'a', { type: 'drawStock' }))
    expect(ids(next.players[0].red3s)).toEqual([stock[1].id])
    expect(ids(next.players[0].hand)).toContain(stock[0].id)
  })

  it('ends the round with no going-out bonus when the stock is empty', () => {
    const game = makeGame({
      players: twoPlayers({ id: 'a', hand: cards('4c') }),
      stock: [],
      phase: 'draw',
    })
    const next = unwrap(applyAction(game, 'a', { type: 'drawStock' }))
    expect(next.status).toBe('roundOver')
    expect(next.history[0]).toMatchObject({ endedBy: 'stockOut', wentOut: null })
    expect(next.history[0].breakdown.a.goingOutBonus).toBe(0)
  })

  it('ends the round when the only cards left are red 3s', () => {
    const game = makeGame({
      players: twoPlayers({ id: 'a', hand: cards('4c'), melds: [meld('Qh Qd Qs')] }),
      stock: cards('3h'),
      phase: 'draw',
    })
    const next = unwrap(applyAction(game, 'a', { type: 'drawStock' }))
    expect(next.status).toBe('roundOver')
    expect(next.players[0].red3s).toHaveLength(1)
    expect(next.history[0].breakdown.a.red3Points).toBe(100)
    expect(next.history[0]).toMatchObject({ endedBy: 'stockOut', wentOut: null })
  })
})

describe('meld', () => {
  it('moves cards from hand into a new meld', () => {
    const nines = cards('9h 9s 9d')
    const game = makeGame({
      players: twoPlayers({
        id: 'a',
        hand: [...nines, ...cards('4c 5c')],
        melds: [meld('Qh Qd Qs')],
      }),
    })
    const next = unwrap(
      applyAction(game, 'a', { type: 'meld', play: { newMelds: [ids(nines)], additions: [] } }),
    )
    expect(next.players[0].hand).toHaveLength(2)
    expect(next.players[0].melds[1]).toMatchObject({ id: 'm100', rank: '9' })
  })

  it('rejects melding before drawing', () => {
    const nines = cards('9h 9s 9d')
    const game = makeGame({
      players: twoPlayers({
        id: 'a',
        hand: [...nines, ...cards('4c 5c')],
        melds: [meld('Qh Qd Qs')],
      }),
      phase: 'draw',
    })
    expect(
      errorCode(game, 'a', { type: 'meld', play: { newMelds: [ids(nines)], additions: [] } }),
    ).toBe('WRONG_PHASE')
  })

  it('ends the round with the concealed bonus when going out in one play', () => {
    const kings = cards('Kh Kd Ks Kc Kh Kd Ks')
    const fours = cards('4h 4d 4s')
    const game = makeGame({ players: twoPlayers({ id: 'a', hand: [...kings, ...fours] }) })
    const next = unwrap(
      applyAction(game, 'a', {
        type: 'meld',
        play: { newMelds: [ids(kings), ids(fours)], additions: [] },
      }),
    )
    expect(next.status).toBe('roundOver')
    expect(next.history[0].breakdown.a).toEqual({
      meldPoints: 85,
      canastaBonus: 500,
      red3Points: 0,
      goingOutBonus: 100,
      concealedBonus: 200,
      handPenalty: 0,
      total: 885,
    })
  })
})

describe('pickUpPile', () => {
  it('melds the top card, takes the rest, and lifts the personal freeze', () => {
    const discard = cards('Jc 8d 9h')
    const top = discard[2]
    const pair = cards('9s 9d')
    const keep = cards('4c')
    const game = makeGame({
      players: twoPlayers({ id: 'a', hand: [...pair, ...keep], melds: [meld('Qh Qd Qs')] }),
      discard,
      phase: 'draw',
    })
    const next = unwrap(
      applyAction(game, 'a', {
        type: 'pickUpPile',
        play: { newMelds: [[top.id, ...ids(pair)]], additions: [] },
      }),
    )
    const a = next.players[0]
    const byId = (x: number, y: number) => x - y
    expect(ids(a.hand).sort(byId)).toEqual([...ids(keep), discard[0].id, discard[1].id].sort(byId))
    expect(a.melds).toHaveLength(2)
    expect(a.hasPickedUpPile).toBe(true)
    expect(next.round!.discard).toEqual([])
    expect(next.round!.phase).toBe('play')
  })

  it('clears a wild freeze once the pile is taken', () => {
    const discard = cards('Jc 9h')
    const pair = cards('9s 9d')
    const game = makeGame({
      players: twoPlayers({
        id: 'a',
        hand: [...pair, ...cards('4c')],
        melds: [meld('Qh Qd Qs')],
        hasPickedUpPile: true,
      }),
      discard,
      phase: 'draw',
      pileFrozenForAll: true,
    })
    const next = unwrap(
      applyAction(game, 'a', {
        type: 'pickUpPile',
        play: { newMelds: [[discard[1].id, ...ids(pair)]], additions: [] },
      }),
    )
    expect(next.round!.pileFrozenForAll).toBe(false)
  })
})

describe('discard', () => {
  it('ends the turn and starts the next player on the draw phase', () => {
    const hand = cards('4c 5c 6c')
    const game = makeGame({
      players: twoPlayers(
        { id: 'a', hand, melds: [meld('Qh Qd Qs')] },
        { id: 'b', hand: cards('Kh Kd'), turnsThisRound: 1 },
      ),
    })
    const next = unwrap(applyAction(game, 'a', { type: 'discard', cardId: hand[0].id }))
    expect(next.round!.current).toBe(1)
    expect(next.round!.phase).toBe('draw')
    expect(next.players[1].turnsThisRound).toBe(2)
    expect(next.round!.discard.at(-1)!.id).toBe(hand[0].id)
  })

  it('freezes the pile for everyone when a wild is discarded', () => {
    const hand = cards('2c 5c 6c')
    const game = makeGame({ players: twoPlayers({ id: 'a', hand }) })
    const next = unwrap(applyAction(game, 'a', { type: 'discard', cardId: hand[0].id }))
    expect(next.round!.pileFrozenForAll).toBe(true)
  })

  it('goes out by discarding the last card', () => {
    const hand = cards('4c')
    const game = makeGame({ players: twoPlayers({ id: 'a', hand, melds: [canastaOf5s()] }) })
    const next = unwrap(applyAction(game, 'a', { type: 'discard', cardId: hand[0].id }))
    expect(next.status).toBe('roundOver')
    expect(next.history[0]).toMatchObject({ endedBy: 'goingOut', wentOut: 'a' })
    expect(next.players.map((p) => p.score)).toEqual([635, -20])
  })

  it("can't discard the last card on the first turn", () => {
    const hand = cards('4c')
    const game = makeGame({
      players: twoPlayers({ id: 'a', hand, melds: [canastaOf5s()], turnsThisRound: 1 }),
    })
    expect(errorCode(game, 'a', { type: 'discard', cardId: hand[0].id })).toBe(
      'CANNOT_GO_OUT_FIRST_TURN',
    )
  })
})

describe('winning', () => {
  it('ends the game when someone reaches 5,000', () => {
    const hand = cards('4c')
    const game = makeGame({
      players: twoPlayers(
        { id: 'a', score: 4900, hand, melds: [canastaOf5s()] },
        { id: 'b', score: 4950, hand: cards('Kh Kd') },
      ),
    })
    const next = unwrap(applyAction(game, 'a', { type: 'discard', cardId: hand[0].id }))
    expect(next.status).toBe('gameOver')
    expect(next.winners).toEqual(['a'])
  })

  it('shares the win on an exact tie for the highest score', () => {
    const hand = cards('4c')
    const game = makeGame({
      players: twoPlayers(
        { id: 'a', score: 4900, hand, melds: [canastaOf5s()] },
        { id: 'b', score: 5555, hand: cards('Kh Kd') },
      ),
    })
    const next = unwrap(applyAction(game, 'a', { type: 'discard', cardId: hand[0].id }))
    expect(next.players.map((p) => p.score)).toEqual([5535, 5535])
    expect(next.winners).toEqual(['a', 'b'])
  })
})

describe('feed', () => {
  it('records a draw with the red 3s it turned up, but not the drawn card', () => {
    const stock = cards('9c 3h')
    const game = makeGame({
      players: twoPlayers({ id: 'a', hand: cards('4c') }),
      stock,
      phase: 'draw',
    })
    const next = unwrap(applyAction(game, 'a', { type: 'drawStock' }))
    expect(next.round!.feed).toEqual([{ type: 'drewStock', playerId: 'a', red3s: [stock[1]] }])
  })

  it('records a stock-out after the draw that found nothing', () => {
    const game = makeGame({
      players: twoPlayers({ id: 'a', hand: cards('4c') }),
      stock: [],
      phase: 'draw',
    })
    const next = unwrap(applyAction(game, 'a', { type: 'drawStock' }))
    expect(next.round!.feed).toEqual([
      { type: 'drewStock', playerId: 'a', red3s: [] },
      { type: 'stockOut' },
    ])
  })

  it('records a pickup with the whole pile size and the cards it melded', () => {
    const discard = cards('Jc 8d 9h')
    const pair = cards('9s 9d')
    const game = makeGame({
      players: twoPlayers({ id: 'a', hand: [...pair, ...cards('4c')], melds: [meld('Qh Qd Qs')] }),
      discard,
      phase: 'draw',
    })
    const next = unwrap(
      applyAction(game, 'a', {
        type: 'pickUpPile',
        play: { newMelds: [[discard[2].id, ...ids(pair)]], additions: [] },
      }),
    )
    expect(next.round!.feed).toEqual([
      {
        type: 'pickedUpPile',
        playerId: 'a',
        count: 3,
        played: { newMelds: [[discard[2], ...pair]], additions: [] },
      },
    ])
  })

  it('records melds and additions', () => {
    const queens = meld('Qh Qd Qs')
    const nines = cards('9h 9s 9d')
    const queen = cards('Qc')
    const game = makeGame({
      players: twoPlayers({
        id: 'a',
        hand: [...nines, ...queen, ...cards('4c 5c')],
        melds: [queens],
      }),
    })
    const next = unwrap(
      applyAction(game, 'a', {
        type: 'meld',
        play: { newMelds: [ids(nines)], additions: [{ meldId: queens.id, cardIds: ids(queen) }] },
      }),
    )
    expect(next.round!.feed).toEqual([
      {
        type: 'melded',
        playerId: 'a',
        played: { newMelds: [nines], additions: [{ meldId: queens.id, cards: queen }] },
      },
    ])
  })

  it('keeps a past meld event unchanged when cards are later added to that meld', () => {
    const nines = cards('9h 9s 9d')
    const more = cards('9c')
    const game = makeGame({
      players: twoPlayers({
        id: 'a',
        hand: [...nines, ...more, ...cards('4c 5c')],
        melds: [meld('Qh Qd Qs')],
      }),
    })
    const first = unwrap(
      applyAction(game, 'a', { type: 'meld', play: { newMelds: [ids(nines)], additions: [] } }),
    )
    const meldId = first.players[0].melds[1].id
    const second = unwrap(
      applyAction(first, 'a', {
        type: 'meld',
        play: { newMelds: [], additions: [{ meldId, cardIds: ids(more) }] },
      }),
    )
    expect(second.round!.feed[0]).toMatchObject({ played: { newMelds: [nines] } })
  })

  it('records a discard, and going out after the discard that emptied the hand', () => {
    const hand = cards('4c')
    const game = makeGame({ players: twoPlayers({ id: 'a', hand, melds: [canastaOf5s()] }) })
    const next = unwrap(applyAction(game, 'a', { type: 'discard', cardId: hand[0].id }))
    expect(next.round!.feed).toEqual([
      { type: 'discarded', playerId: 'a', card: hand[0] },
      { type: 'wentOut', playerId: 'a' },
    ])
  })

  it('records going out by melding', () => {
    const kings = cards('Kh Kd Ks Kc Kh Kd Ks')
    const game = makeGame({ players: twoPlayers({ id: 'a', hand: kings }) })
    const next = unwrap(
      applyAction(game, 'a', { type: 'meld', play: { newMelds: [ids(kings)], additions: [] } }),
    )
    expect(next.round!.feed.map((e) => e.type)).toEqual(['melded', 'wentOut'])
  })
})
