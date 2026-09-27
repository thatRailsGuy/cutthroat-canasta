import { describe, expect, it } from 'vitest'
import { cardValue, deckCount, handSize, initialMeldMinimum } from '../src/constants'
import type { Card, Rank } from '../src/cards'

const card = (rank: Rank): Card => ({ id: 0, rank, suit: rank === 'JOKER' ? null : 'spades' })

describe('cardValue', () => {
  it.each([
    ['JOKER', 50],
    ['2', 20],
    ['A', 20],
    ['K', 10],
    ['8', 10],
    ['7', 5],
    ['4', 5],
    ['3', 5],
  ] as const)('values %s at %i', (rank, value) => {
    expect(cardValue(card(rank))).toBe(value)
  })
})

describe('deckCount and handSize', () => {
  it.each([
    [2, 2, 15],
    [3, 2, 13],
    [4, 2, 13],
    [5, 3, 13],
    [6, 3, 13],
    [7, 4, 13],
    [8, 4, 13],
  ])('%i players use %i decks and %i-card hands', (players, decks, hand) => {
    expect(deckCount(players)).toBe(decks)
    expect(handSize(players)).toBe(hand)
  })
})

describe('initialMeldMinimum', () => {
  it.each([
    [-500, 15],
    [-5, 15],
    [0, 50],
    [1495, 50],
    [1500, 90],
    [2995, 90],
    [3000, 120],
    [9000, 120],
  ])('a score of %i needs %i points', (score, minimum) => {
    expect(initialMeldMinimum(score)).toBe(minimum)
  })
})
