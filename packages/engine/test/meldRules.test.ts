import { describe, expect, it } from 'vitest'
import { checkMeldCards, isCanasta, isNaturalCanasta } from '../src/meldRules'
import { cards, meld } from './fixtures'

const code = (hand: string) => checkMeldCards(cards(hand))?.code ?? null

describe('checkMeldCards', () => {
  it.each([
    ['three naturals', '9h 9s 9d'],
    ['two naturals and a deuce', '9h 9s 2c'],
    ['2 natural + 2 jokers (sheet example)', '9h 9s JK JK'],
    ['3 natural + 2 jokers (sheet example)', '9h 9s 9d JK JK'],
    ['2 natural + 1 joker + 1 deuce (sheet example)', '9h 9s JK 2c'],
    ['3 natural + 2 jokers + 1 deuce (all wilds equal naturals)', '9h 9s 9d JK JK 2c'],
    ['aces', 'Ah As Ad'],
  ])('accepts %s', (_, hand) => {
    expect(code(hand)).toBeNull()
  })

  it.each([
    ['2 natural + 3 jokers (sheet example)', '9h 9s JK JK JK', 'WILDS_EXCEED_NATURALS'],
    [
      '2 natural + 2 deuces + 1 joker (deuces count as wild)',
      '9h 9s 2c 2d JK',
      'WILDS_EXCEED_NATURALS',
    ],
    ['one natural and two wilds', '9h 2c JK', 'MELD_NEEDS_TWO_NATURALS'],
    ['only two cards', '9h 9s', 'MELD_TOO_SMALL'],
    ['mixed ranks', '9h 9s 10d', 'MELD_MIXED_RANKS'],
    ['black 3s', '3c 3s 3c', 'THREES_NOT_MELDABLE'],
    ['red 3s', '3h 3d 3h', 'THREES_NOT_MELDABLE'],
    ['a black 3 mixed in', '9h 9s 3c', 'THREES_NOT_MELDABLE'],
  ])('rejects %s', (_, hand, expected) => {
    expect(code(hand)).toBe(expected)
  })
})

describe('canasta detection', () => {
  it('needs 7 or more cards', () => {
    expect(isCanasta(meld('5h 5d 5s 5c 5h 5d'))).toBe(false)
    expect(isCanasta(meld('5h 5d 5s 5c 5h 5d 5s'))).toBe(true)
    expect(isCanasta(meld('5h 5d 5s 5c 5h 5d 5s 5c'))).toBe(true)
  })

  it('is natural only without wilds', () => {
    expect(isNaturalCanasta(meld('5h 5d 5s 5c 5h 5d 5s'))).toBe(true)
    expect(isNaturalCanasta(meld('5h 5d 5s 5c 5h 5d 2s'))).toBe(false)
    expect(isNaturalCanasta(meld('5h 5d 5s'))).toBe(false)
  })
})
