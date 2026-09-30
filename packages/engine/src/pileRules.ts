import { isBlack3, isNatural, isRed3, isWild, type Card, type CardId } from './cards'
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
  if (isWild(top) || isBlack3(top) || isRed3(top)) {
    const blocker = isWild(top) ? 'a wild card' : isRed3(top) ? 'a Red 3' : 'a black 3'
    return ruleError('PILE_BLOCKED', `The pile can't be picked up while ${blocker} is on top.`)
  }
  const frozen = isPileFrozenFor(player, pile)
  const hasNaturalPair = (cardIds: CardId[]) =>
    player.hand.filter((c) => cardIds.includes(c.id) && isNatural(c) && c.rank === top.rank)
      .length >= 2

  const addition = batch.additions.find((a) => a.cardIds.includes(top.id))
  if (addition) {
    const target = player.melds.find((m) => m.id === addition.meldId)
    if (!target) return ruleError('MELD_NOT_FOUND', "That meld doesn't exist.")
    // With one unfinished meld per rank, a frozen pile's top card and pair join that meld.
    if (frozen && !hasNaturalPair(addition.cardIds)) return frozenError(top)
    if (isCanasta(target)) {
      return ruleError(
        'CANASTA_CANNOT_TAKE_PILE',
        'A finished canasta cannot take the top discard. Start a new meld with a pair from your hand instead.',
      )
    }
    return null
  }

  const newMeld = batch.newMelds.find((cardIds) => cardIds.includes(top.id))
  if (!newMeld) {
    return ruleError(
      'PICKUP_TOP_CARD_NOT_PLACED',
      'To pick up the pile you must meld the top discard in the same play.',
    )
  }
  if (frozen && !hasNaturalPair(newMeld)) return frozenError(top)
  return null
}
