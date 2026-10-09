import { describe, expect, it } from 'vitest'
import {
  cardDescription,
  cardLabel,
  cardName,
  rankGroups,
  rankIndex,
  rankPlural,
  sortHand,
} from '../src/cards'
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

  it('groups a sorted hand into runs of one rank, with each wild on its own', () => {
    const hand = ['7h', 'Ks', '3c', '2d', '7c', 'JK', '9h', '2s', 'JK'].map((c, i) => card(c, i))
    const codes = rankGroups(hand).map((g) => g.map(cardLabel).join(' '))
    expect(codes).toEqual(['Joker', 'Joker', '2♠', '2♦', 'K♠', '9♥', '7♥ 7♣', '3♣'])
  })
})

describe('cardDescription', () => {
  it('says what a wild or a 3 does, and leaves other cards as they are', () => {
    expect(cardDescription(card('2c', 1))).toBe('2 of clubs, wild')
    expect(cardDescription(card('JK', 2))).toBe('Joker, wild')
    expect(cardDescription(card('3h', 3))).toBe('3 of hearts, red 3')
    expect(cardDescription(card('3s', 4))).toBe('3 of spades, black 3')
    expect(cardDescription(card('Kd', 5))).toBe('King of diamonds')
  })
})
