import { describe, expect, it } from 'vitest'
import { cardValueRows, initialMeldRows, tableSizeRows } from '../src/rules/tables'

describe('rules tables', () => {
  it('group card values from the engine', () => {
    expect(cardValueRows().map((r) => [r.cards, r.points])).toEqual([
      ['Joker', 50],
      ['2', 20],
      ['A', 20],
      ['K, Q, J, 10, 9, 8', 10],
      ['7, 6, 5, 4', 5],
      ['Black 3', 5],
    ])
  })

  it('label the initial meld tiers', () => {
    expect(initialMeldRows()).toEqual([
      { score: 'Below 0', minimum: 15 },
      { score: '0 – 1,495', minimum: 50 },
      { score: '1,500 – 2,995', minimum: 90 },
      { score: '3,000 or more', minimum: 120 },
    ])
  })

  it('group player counts by decks and hand size', () => {
    expect(tableSizeRows()).toEqual([
      { players: '2', decks: 2, hand: 15 },
      { players: '3–4', decks: 2, hand: 13 },
      { players: '5–6', decks: 3, hand: 13 },
      { players: '7–8', decks: 4, hand: 13 },
    ])
  })
})
