import { isNatural, type Card, type CardId, type NaturalRank } from './cards'
import { CANASTA_SIZE, cardValue, initialMeldMinimum } from './constants'
import { ruleError, type RuleError } from './errors'
import { checkMeldCards, isCanasta, isNaturalCanasta } from './meldRules'
import { checkPickupShape, type PileState } from './pileRules'
import { goingOutBlocker } from './turnRules'
import type { CompletedCanasta, Meld, MeldBatch, Player, Round } from './types'

export interface PlayContext {
  player: Player
  pile: PileState
  /** Total cards in the discard pile, including the top card. */
  pileSize: number
  takesPile: boolean
}

export interface ValidatedPlay {
  newMelds: Card[][]
  additions: { meldId: string; cards: Card[] }[]
  usedFromHand: CardId[]
  goesOut: boolean
}

export type PlayResult = { ok: true; play: ValidatedPlay } | { ok: false; error: RuleError }

const fail = (error: RuleError): PlayResult => ({ ok: false, error })

export function validatePlay(ctx: PlayContext, batch: MeldBatch): PlayResult {
  const { player, pile, takesPile } = ctx
  if (takesPile) {
    const shapeError = checkPickupShape(player, pile, batch)
    if (shapeError) return fail(shapeError)
  }

  const available = new Map<CardId, Card>(player.hand.map((c) => [c.id, c]))
  if (takesPile && pile.top) available.set(pile.top.id, pile.top)

  const allIds = [...batch.newMelds.flat(), ...batch.additions.flatMap((a) => a.cardIds)]
  if (allIds.length === 0) return fail(ruleError('EMPTY_PLAY', 'Select some cards to meld.'))
  if (new Set(allIds).size !== allIds.length) {
    return fail(ruleError('DUPLICATE_CARD', 'The same card was used twice.'))
  }
  if (allIds.some((id) => !available.has(id))) {
    return fail(ruleError('CARD_NOT_IN_HAND', 'You can only meld cards from your hand.'))
  }
  const lookup = (id: CardId) => available.get(id)!

  const newMelds = batch.newMelds.map((cardIds) => cardIds.map(lookup))
  for (const meldCards of newMelds) {
    const error = checkMeldCards(meldCards)
    if (error) return fail(error)
  }

  const grouped = new Map<string, CardId[]>()
  for (const a of batch.additions) {
    if (a.cardIds.length > 0)
      grouped.set(a.meldId, [...(grouped.get(a.meldId) ?? []), ...a.cardIds])
  }
  const additions: ValidatedPlay['additions'] = []
  for (const [meldId, cardIds] of grouped) {
    const target = player.melds.find((m) => m.id === meldId)
    if (!target) return fail(ruleError('MELD_NOT_FOUND', "That meld doesn't exist."))
    const added = cardIds.map(lookup)
    const error = checkMeldCards([...target.cards, ...added])
    if (error) return fail(error)
    additions.push({ meldId, cards: added })
  }

  // A player may start another meld of a rank only once their meld of that rank is a canasta.
  const rankOf = (cards: Card[]) => cards.find(isNatural)!.rank
  for (const rank of new Set(newMelds.map(rankOf))) {
    const unfinished = [
      ...player.melds
        .filter((m) => m.rank === rank)
        .map((m) => m.cards.length + (grouped.get(m.id)?.length ?? 0)),
      ...newMelds.filter((cards) => rankOf(cards) === rank).map((cards) => cards.length),
    ].filter((size) => size < CANASTA_SIZE)
    if (unfinished.length > 1) {
      return fail(
        ruleError(
          'RANK_ALREADY_MELDED',
          `You can only have one unfinished meld of ${rank}s. Add to it: you can start another once it is a canasta.`,
        ),
      )
    }
  }

  if (player.melds.length === 0) {
    const placed = [...newMelds.flat(), ...additions.flatMap((a) => a.cards)]
    const points = placed.reduce((sum, c) => sum + cardValue(c), 0)
    const minimum = initialMeldMinimum(player.score)
    if (points < minimum) {
      return fail(
        ruleError(
          'INITIAL_MELD_TOO_LOW',
          `Your first meld this round must total at least ${minimum} points (this one is ${points}).`,
        ),
      )
    }
  }

  const handIds = new Set(player.hand.map((c) => c.id))
  const usedFromHand = allIds.filter((id) => handIds.has(id))
  const pileCardsGained = takesPile ? ctx.pileSize - 1 : 0
  const handAfter = player.hand.length - usedFromHand.length + pileCardsGained
  const sizesAfter = [
    ...player.melds.map((m) => m.cards.length + (grouped.get(m.id)?.length ?? 0)),
    ...newMelds.map((meldCards) => meldCards.length),
  ]
  const blocker = goingOutBlocker(
    player,
    sizesAfter.some((size) => size >= CANASTA_SIZE),
  )
  if (handAfter === 0 && blocker) return fail(blocker)
  if (handAfter === 1 && blocker) {
    return fail(
      ruleError(
        'MUST_KEEP_CARD_TO_DISCARD',
        "You can't go out yet, so you must keep at least 2 cards: one to discard and one to hold.",
      ),
    )
  }

  return { ok: true, play: { newMelds, additions, usedFromHand, goesOut: handAfter === 0 } }
}

/**
 * Moves a validated play's cards into melds, and returns the melds it made into canastas.
 * Mutates; callers pass a cloned game.
 */
export function applyPlay(round: Round, player: Player, play: ValidatedPlay): CompletedCanasta[] {
  const used = new Set(play.usedFromHand)
  player.hand = player.hand.filter((c) => !used.has(c.id))
  const wasCanasta = new Set(player.melds.filter(isCanasta).map((m) => m.id))
  const touched: Meld[] = []
  for (const meldCards of play.newMelds) {
    const natural = meldCards.find(isNatural)!
    const meld = {
      id: `m${round.nextMeldId++}`,
      rank: natural.rank as NaturalRank,
      cards: meldCards,
    }
    player.melds.push(meld)
    touched.push(meld)
  }
  for (const addition of play.additions) {
    const meld = player.melds.find((m) => m.id === addition.meldId)!
    meld.cards.push(...addition.cards)
    touched.push(meld)
  }
  return touched
    .filter((m) => isCanasta(m) && !wasCanasta.has(m.id))
    .map((m) => ({ rank: m.rank, natural: isNaturalCanasta(m) }))
}
