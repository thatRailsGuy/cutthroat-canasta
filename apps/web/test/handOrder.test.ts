import type { Card } from '@canasta/engine'
import { describe, expect, it } from 'vitest'
import { cardLabel } from '../src/cards'
import { arrangeHand, moveCard } from '../src/handOrder'
import { card } from './fixtures'

const hand = ['4c', 'Ah', '8d', 'JK', '8s'].map((c, i) => card(c, i + 1))
const labels = (cards: Card[]) => cards.map(cardLabel)

describe('arrangeHand', () => {
  it('sorts the hand when you have no order of your own', () => {
    expect(labels(arrangeHand(hand, null))).toEqual(['Joker', 'A♥', '8♠', '8♦', '4♣'])
  })

  it('keeps your order, drops cards that left, and puts new cards at the end', () => {
    const drawn = card('Kc', 9)
    const cards = [...hand.filter((c) => c.id !== 3), drawn]
    const arranged = arrangeHand(cards, [1, 3, 2, 4, 5])
    expect(arranged.map((c) => c.id)).toEqual([1, 2, 4, 5, 9])
  })
})

describe('moveCard', () => {
  const sorted = arrangeHand(hand, null)

  it('moves a card before another one', () => {
    const order = moveCard(sorted, 1, 4)
    expect(labels(arrangeHand(hand, order))).toEqual(['4♣', 'Joker', 'A♥', '8♠', '8♦'])
  })

  it('moves a card to the end', () => {
    const order = moveCard(sorted, 4, null)
    expect(labels(arrangeHand(hand, order))).toEqual(['A♥', '8♠', '8♦', '4♣', 'Joker'])
  })

  it('counts the hand as sorted again when a move restores the sorted order', () => {
    const moved = arrangeHand(hand, moveCard(sorted, 1, 4))
    expect(moveCard(moved, 1, null)).toBeNull()
  })
})
