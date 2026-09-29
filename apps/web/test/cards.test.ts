import { describe, expect, it } from 'vitest'
import { cardLabel, cardName, rankIndex, rankPlural, sortHand } from '../src/cards'
import { card } from './fixtures'

describe('card helpers', () => {
  it('labels and names cards', () => {
    expect(cardLabel(card('7h', 1))).toBe('7♥')
    expect(cardLabel(card('JK', 2))).toBe('Joker')
    expect(cardName(card('Qs', 3))).toBe('Queen of spades')
  })

  it('names ranks in the plural and orders them like a hand', () => {
    expect((['A', 'K', '10', '7'] as const).map((r) => rankPlural(r))).toEqual([
      'Aces',
      'Kings',
      '10s',
      '7s',
    ])
    expect(rankIndex('A')).toBeLessThan(rankIndex('K'))
    expect(rankIndex('K')).toBeLessThan(rankIndex('10'))
    expect(rankIndex('4')).toBeLessThan(rankIndex('3'))
  })

  it('sorts a hand: wilds, then Ace down to 4, then 3s', () => {
    const hand = [
      card('4c', 1),
      card('3s', 2),
      card('Ah', 3),
      card('2d', 4),
      card('JK', 5),
      card('Kc', 6),
    ]
    expect(sortHand(hand).map(cardLabel)).toEqual(['Joker', '2♦', 'A♥', 'K♣', '4♣', '3♠'])
  })
})
