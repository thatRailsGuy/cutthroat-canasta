import { describe, expect, it } from 'vitest'
import { buildDeck } from '../src/deck'
import { isRed3 } from '../src/cards'

describe('buildDeck', () => {
  it('builds 54 cards per deck with unique sequential ids', () => {
    const deck = buildDeck(2)
    expect(deck).toHaveLength(108)
    expect(deck.map((c) => c.id)).toEqual(Array.from({ length: 108 }, (_, i) => i))
  })

  it('includes two jokers and two red 3s per deck', () => {
    const deck = buildDeck(4)
    expect(deck).toHaveLength(216)
    expect(deck.filter((c) => c.rank === 'JOKER')).toHaveLength(8)
    expect(deck.filter((c) => c.rank === 'JOKER').every((c) => c.suit === null)).toBe(true)
    expect(deck.filter(isRed3)).toHaveLength(8)
  })
})
