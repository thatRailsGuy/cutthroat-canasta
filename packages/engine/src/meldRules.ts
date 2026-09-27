import { isNatural, isWild, type Card } from './cards'
import { CANASTA_SIZE, MIN_MELD_SIZE } from './constants'
import { ruleError, type RuleError } from './errors'
import type { Meld } from './types'

/** Validates a complete meld: a new one, or an existing meld plus added cards. */
export function checkMeldCards(cards: Card[]): RuleError | null {
  if (cards.some((c) => c.rank === '3')) {
    return ruleError('THREES_NOT_MELDABLE', '3s can never be melded.')
  }
  if (cards.length < MIN_MELD_SIZE) {
    return ruleError('MELD_TOO_SMALL', `A meld needs at least ${MIN_MELD_SIZE} cards.`)
  }
  const naturals = cards.filter(isNatural)
  if (new Set(naturals.map((c) => c.rank)).size > 1) {
    return ruleError('MELD_MIXED_RANKS', 'Every natural card in a meld must be the same rank.')
  }
  if (naturals.length < 2) {
    return ruleError('MELD_NEEDS_TWO_NATURALS', 'A meld needs at least 2 natural cards.')
  }
  const wilds = cards.length - naturals.length
  if (wilds > naturals.length) {
    return ruleError(
      'WILDS_EXCEED_NATURALS',
      `Wild cards can't outnumber natural cards (${wilds} wild vs ${naturals.length} natural).`,
    )
  }
  return null
}

export function isCanasta(meld: Meld): boolean {
  return meld.cards.length >= CANASTA_SIZE
}

export function isNaturalCanasta(meld: Meld): boolean {
  return isCanasta(meld) && !meld.cards.some(isWild)
}
