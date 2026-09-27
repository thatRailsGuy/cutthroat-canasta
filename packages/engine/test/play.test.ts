import { describe, expect, it } from 'vitest'
import { validatePlay, type PlayResult } from '../src/play'
import type { PileState } from '../src/pileRules'
import type { Card } from '../src/cards'
import type { MeldBatch, Player } from '../src/types'
import { card, cards, ids, makePlayer, meld } from './fixtures'

const batch = (
  newMelds: Card[][],
  additions: { meldId: string; cards: Card[] }[] = [],
): MeldBatch => ({
  newMelds: newMelds.map(ids),
  additions: additions.map((a) => ({ meldId: a.meldId, cardIds: ids(a.cards) })),
})
const noPile: PileState = { top: null, pileFrozenForAll: false }
const play = (player: Player, b: MeldBatch) =>
  validatePlay({ player, pile: noPile, pileSize: 0, takesPile: false }, b)
const pickup = (player: Player, top: Card, pileSize: number, b: MeldBatch) =>
  validatePlay({ player, pile: { top, pileFrozenForAll: false }, pileSize, takesPile: true }, b)
const errorCode = (result: PlayResult) => (result.ok ? null : result.error.code)
const canastaOf5s = () => meld('5h 5d 5s 5c 5h 5d 5s')

describe('validatePlay: basic melds', () => {
  it('accepts a new meld and reports the cards used from hand', () => {
    const nines = cards('9h 9s 9d')
    const player = makePlayer({
      id: 'a',
      hand: [...nines, ...cards('4c 6c')],
      melds: [meld('Qh Qd Qs')],
    })
    const result = play(player, batch([nines]))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.play.usedFromHand).toEqual(ids(nines))
      expect(result.play.goesOut).toBe(false)
    }
  })

  it('allows a second meld of a rank the player already has', () => {
    const fives = cards('5h 5s 5d')
    const player = makePlayer({
      id: 'a',
      hand: [...fives, ...cards('4c 6c')],
      melds: [canastaOf5s()],
    })
    expect(errorCode(play(player, batch([fives])))).toBeNull()
  })

  it('allows adding cards from hand to a finished canasta', () => {
    const canasta = canastaOf5s()
    const [five] = cards('5c')
    const player = makePlayer({ id: 'a', hand: [five, ...cards('4c 6c')], melds: [canasta] })
    expect(errorCode(play(player, batch([], [{ meldId: canasta.id, cards: [five] }])))).toBeNull()
  })

  it('rejects cards that are not in hand', () => {
    const player = makePlayer({ id: 'a', hand: cards('9h 9s 4c 6c'), melds: [meld('Qh Qd Qs')] })
    expect(errorCode(play(player, batch([[...player.hand.slice(0, 2), card('9d')]])))).toBe(
      'CARD_NOT_IN_HAND',
    )
  })

  it('rejects the top discard in a normal meld', () => {
    const top = card('9d')
    const player = makePlayer({ id: 'a', hand: cards('9h 9s 4c 6c'), melds: [meld('Qh Qd Qs')] })
    const result = validatePlay(
      { player, pile: { top, pileFrozenForAll: false }, pileSize: 3, takesPile: false },
      batch([[top, ...player.hand.slice(0, 2)]]),
    )
    expect(errorCode(result)).toBe('CARD_NOT_IN_HAND')
  })

  it('rejects the same card used twice', () => {
    const [a, b] = cards('9h 9s')
    const player = makePlayer({
      id: 'a',
      hand: [a, b, ...cards('4c 6c')],
      melds: [meld('Qh Qd Qs')],
    })
    expect(errorCode(play(player, batch([[a, b, a]])))).toBe('DUPLICATE_CARD')
  })

  it('rejects an empty play', () => {
    const player = makePlayer({ id: 'a', hand: cards('4c 6c'), melds: [meld('Qh Qd Qs')] })
    expect(errorCode(play(player, batch([])))).toBe('EMPTY_PLAY')
  })

  it('rejects additions to a meld the player does not own', () => {
    const [five] = cards('5c')
    const player = makePlayer({
      id: 'a',
      hand: [five, ...cards('4c 6c')],
      melds: [meld('Qh Qd Qs')],
    })
    expect(errorCode(play(player, batch([], [{ meldId: 'nope', cards: [five] }])))).toBe(
      'MELD_NOT_FOUND',
    )
  })

  it('validates additions to the same meld together', () => {
    const existing = meld('5h 5d 2c')
    const [joker, deuce] = cards('JK 2s')
    const player = makePlayer({
      id: 'a',
      hand: [joker, deuce, ...cards('4c 6c')],
      melds: [existing],
    })
    const result = play(
      player,
      batch(
        [],
        [
          { meldId: existing.id, cards: [joker] },
          { meldId: existing.id, cards: [deuce] },
        ],
      ),
    )
    expect(errorCode(result)).toBe('WILDS_EXCEED_NATURALS')
  })
})

describe('validatePlay: initial meld', () => {
  it('rejects a first meld below the minimum', () => {
    const kings = cards('Kh Kd Ks')
    const player = makePlayer({ id: 'a', hand: [...kings, ...cards('4c 5c')] })
    const result = play(player, batch([kings]))
    expect(errorCode(result)).toBe('INITIAL_MELD_TOO_LOW')
    expect(result.ok ? '' : result.error.message).toContain('50')
  })

  it('adds up several melds laid down together', () => {
    const kings = cards('Kh Kd Ks')
    const eights = cards('8h 8d 8s')
    const player = makePlayer({ id: 'a', hand: [...kings, ...eights, ...cards('4c 5c')] })
    expect(errorCode(play(player, batch([kings, eights])))).toBeNull()
  })

  it.each([
    [-200, '4h 4d 4s', null],
    [1500, 'Ah Ad As', 'INITIAL_MELD_TOO_LOW'],
    [1500, 'Ah Ad As JK', null],
    [3000, 'Ah Ad As JK', 'INITIAL_MELD_TOO_LOW'],
  ])('at score %i, %s gives %s', (score, codes, expected) => {
    const meldCards = cards(codes)
    const player = makePlayer({ id: 'a', score, hand: [...meldCards, ...cards('4c 5c')] })
    expect(errorCode(play(player, batch([meldCards])))).toBe(expected)
  })

  it('does not apply once the player has melded this round', () => {
    const fours = cards('4h 4d 4s')
    const player = makePlayer({
      id: 'a',
      score: 3000,
      hand: [...fours, ...cards('9c 5c')],
      melds: [meld('Qh Qd Qs')],
    })
    expect(errorCode(play(player, batch([fours])))).toBeNull()
  })

  it('counts the picked-up top card toward the minimum', () => {
    const top = card('Ah')
    const pair = cards('Ad As')
    const player = makePlayer({ id: 'a', hand: [...pair, ...cards('4c 5c 6c')] })
    expect(errorCode(pickup(player, top, 5, batch([[top, ...pair]])))).toBeNull()
  })

  it('still rejects a pickup meld that falls short', () => {
    const top = card('Kh')
    const pair = cards('Kd Ks')
    const player = makePlayer({ id: 'a', hand: [...pair, ...cards('4c 5c 6c')] })
    expect(errorCode(pickup(player, top, 5, batch([[top, ...pair]])))).toBe('INITIAL_MELD_TOO_LOW')
  })
})

describe('validatePlay: going out', () => {
  it('goes out when every card is melded and the player has a canasta', () => {
    const kings = cards('Kh Kd Ks')
    const player = makePlayer({ id: 'a', hand: kings, melds: [canastaOf5s()] })
    const result = play(player, batch([kings]))
    expect(result.ok && result.play.goesOut).toBe(true)
  })

  it('forbids going out on the first turn', () => {
    const kings = cards('Kh Kd Ks')
    const player = makePlayer({ id: 'a', hand: kings, melds: [canastaOf5s()], turnsThisRound: 1 })
    expect(errorCode(play(player, batch([kings])))).toBe('CANNOT_GO_OUT_FIRST_TURN')
  })

  it('forbids going out without a canasta', () => {
    const kings = cards('Kh Kd Ks')
    const player = makePlayer({ id: 'a', hand: kings, melds: [meld('Qh Qd Qs')] })
    expect(errorCode(play(player, batch([kings])))).toBe('GOING_OUT_NEEDS_CANASTA')
  })

  it('counts a canasta completed in the same play', () => {
    const almost = meld('5h 5d 5s 5c 5h 5d')
    const [five] = cards('5s')
    const kings = cards('Kh Kd Ks')
    const player = makePlayer({ id: 'a', hand: [five, ...kings], melds: [almost] })
    const result = play(player, batch([kings], [{ meldId: almost.id, cards: [five] }]))
    expect(result.ok && result.play.goesOut).toBe(true)
  })

  it('requires keeping two cards when the player cannot go out', () => {
    const kings = cards('Kh Kd Ks')
    const player = makePlayer({ id: 'a', hand: [...kings, card('4c')], melds: [meld('Qh Qd Qs')] })
    expect(errorCode(play(player, batch([kings])))).toBe('MUST_KEEP_CARD_TO_DISCARD')
  })

  it('allows keeping one card when the player can go out by discarding it', () => {
    const kings = cards('Kh Kd Ks')
    const player = makePlayer({ id: 'a', hand: [...kings, card('4c')], melds: [canastaOf5s()] })
    const result = play(player, batch([kings]))
    expect(result.ok && !result.play.goesOut).toBe(true)
  })

  it('counts cards gained from the pile when checking what is left in hand', () => {
    const top = card('Kh')
    const pair = cards('Kd Ks')
    const player = makePlayer({
      id: 'a',
      hand: pair,
      melds: [meld('Qh Qd Qs')],
      hasPickedUpPile: true,
    })
    expect(errorCode(pickup(player, top, 4, batch([[top, ...pair]])))).toBeNull()
  })
})
