import { describe, expect, it } from 'vitest'
import { checkDiscard, checkPhase, checkTurn, goingOutBlocker } from '../src/turnRules'
import { cards, makePlayer, meld } from './fixtures'

describe('checkTurn', () => {
  it('requires a game in progress', () => {
    expect(checkTurn('lobby', undefined, 'a')?.code).toBe('GAME_NOT_PLAYING')
    expect(checkTurn('roundOver', 'a', 'a')?.code).toBe('GAME_NOT_PLAYING')
  })

  it("rejects a player whose turn it isn't", () => {
    expect(checkTurn('playing', 'b', 'a')?.code).toBe('NOT_YOUR_TURN')
    expect(checkTurn('playing', 'a', 'a')).toBeNull()
  })
})

describe('checkPhase', () => {
  it('allows drawing and picking up only before playing', () => {
    expect(checkPhase('draw', 'drawStock')).toBeNull()
    expect(checkPhase('draw', 'pickUpPile')).toBeNull()
    expect(checkPhase('play', 'drawStock')?.code).toBe('WRONG_PHASE')
    expect(checkPhase('play', 'pickUpPile')?.code).toBe('WRONG_PHASE')
  })

  it('allows melding and discarding only after drawing', () => {
    expect(checkPhase('play', 'meld')).toBeNull()
    expect(checkPhase('play', 'discard')).toBeNull()
    expect(checkPhase('draw', 'meld')?.code).toBe('WRONG_PHASE')
    expect(checkPhase('draw', 'discard')?.code).toBe('WRONG_PHASE')
  })
})

describe('goingOutBlocker', () => {
  it('forbids going out on the first turn even with a canasta', () => {
    expect(goingOutBlocker(makePlayer({ id: 'a', turnsThisRound: 1 }), true)?.code).toBe(
      'CANNOT_GO_OUT_FIRST_TURN',
    )
  })

  it('requires a canasta', () => {
    expect(goingOutBlocker(makePlayer({ id: 'a' }), false)?.code).toBe('GOING_OUT_NEEDS_CANASTA')
    expect(goingOutBlocker(makePlayer({ id: 'a' }), true)).toBeNull()
  })
})

describe('checkDiscard', () => {
  it('requires the card to be in hand', () => {
    const player = makePlayer({ id: 'a', hand: cards('4c 5c') })
    expect(checkDiscard(player, 999_999)?.code).toBe('CARD_NOT_IN_HAND')
    expect(checkDiscard(player, player.hand[0].id)).toBeNull()
  })

  it('only lets you discard your last card if you can go out', () => {
    const noCanasta = makePlayer({ id: 'a', hand: cards('4c'), melds: [meld('Qh Qd Qs')] })
    expect(checkDiscard(noCanasta, noCanasta.hand[0].id)?.code).toBe('GOING_OUT_NEEDS_CANASTA')

    const withCanasta = makePlayer({
      id: 'a',
      hand: cards('4c'),
      melds: [meld('5h 5d 5s 5c 5h 5d 5s')],
    })
    expect(checkDiscard(withCanasta, withCanasta.hand[0].id)).toBeNull()
  })
})
