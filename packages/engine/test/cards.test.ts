import { describe, expect, it } from 'vitest'
import { isBlack3, isNatural, isRed3, isWild, type Card, type Rank, type Suit } from '../src/cards'

const card = (rank: Rank, suit: Suit | null): Card => ({ id: 0, rank, suit })

describe('card predicates', () => {
  it('treats jokers and deuces as wild', () => {
    expect(isWild(card('JOKER', null))).toBe(true)
    expect(isWild(card('2', 'clubs'))).toBe(true)
    expect(isWild(card('A', 'clubs'))).toBe(false)
  })

  it('tells red 3s from black 3s', () => {
    expect(isRed3(card('3', 'hearts'))).toBe(true)
    expect(isRed3(card('3', 'diamonds'))).toBe(true)
    expect(isRed3(card('3', 'clubs'))).toBe(false)
    expect(isBlack3(card('3', 'clubs'))).toBe(true)
    expect(isBlack3(card('3', 'spades'))).toBe(true)
    expect(isBlack3(card('3', 'hearts'))).toBe(false)
  })

  it('counts 4 through A as natural, but not wilds or 3s', () => {
    expect(isNatural(card('4', 'clubs'))).toBe(true)
    expect(isNatural(card('A', 'spades'))).toBe(true)
    expect(isNatural(card('2', 'spades'))).toBe(false)
    expect(isNatural(card('JOKER', null))).toBe(false)
    expect(isNatural(card('3', 'clubs'))).toBe(false)
    expect(isNatural(card('3', 'hearts'))).toBe(false)
  })
})
