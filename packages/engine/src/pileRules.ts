import { isBlack3, isNatural, isWild, type Card } from './cards'
import { ruleError, type RuleError } from './errors'
import { isCanasta } from './meldRules'
import type { MeldBatch, Player, Round } from './types'

export interface PileState {
  top: Card | null
  pileFrozenForAll: boolean
}

export function pileStateOf(round: Round): PileState {
  return { top: round.discard.at(-1) ?? null, pileFrozenForAll: round.pileFrozenForAll }
}

export function isPileFrozenFor(player: Player, pile: PileState): boolean {
  return !player.hasPickedUpPile || pile.pileFrozenForAll
}

function frozenError(top: Card): RuleError {
  return ruleError(
    'FROZEN_NEEDS_NATURAL_PAIR',
    `The pile is frozen for you — you need a natural pair of ${top.rank}s from your hand.`,
  )
}

/** Where the top discard goes in a pickup play (spec 3.6). */
export function checkPickupShape(
  player: Player,
  pile: PileState,
  batch: MeldBatch,
): RuleError | null {
  const top = pile.top
  if (!top) return ruleError('PILE_EMPTY', 'The discard pile is empty.')
  if (isWild(top) || isBlack3(top)) {
    const blocker = isWild(top) ? 'a wild card' : 'a black 3'
    return ruleError('PILE_BLOCKED', `The pile can't be picked up while ${blocker} is on top.`)
  }
  const frozen = isPileFrozenFor(player, pile)

  const addition = batch.additions.find((a) => a.cardIds.includes(top.id))
  if (addition) {
    const target = player.melds.find((m) => m.id === addition.meldId)
    if (!target) return ruleError('MELD_NOT_FOUND', "That meld doesn't exist.")
    if (isCanasta(target)) {
      return ruleError(
        'CANASTA_CANNOT_TAKE_PILE',
        'A finished canasta cannot take the top discard. Start a new meld with a pair from your hand instead.',
      )
    }
    return frozen ? frozenError(top) : null
  }

  const newMeld = batch.newMelds.find((cardIds) => cardIds.includes(top.id))
  if (!newMeld) {
    return ruleError(
      'PICKUP_TOP_CARD_NOT_PLACED',
      'To pick up the pile you must meld the top discard in the same play.',
    )
  }
  if (frozen) {
    const pair = player.hand.filter(
      (c) => newMeld.includes(c.id) && isNatural(c) && c.rank === top.rank,
    )
    if (pair.length < 2) return frozenError(top)
  }
  return null
}
