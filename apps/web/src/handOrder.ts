import type { Card, CardId } from '@canasta/engine'
import { sortHand } from './cards'

/**
 * Your hand in the order you see it. With no order of your own (`null`) it is sorted. With one,
 * cards keep your order, and cards that arrived since go at the end, in the order they came.
 */
export function arrangeHand(cards: readonly Card[], order: readonly CardId[] | null): Card[] {
  if (!order) return sortHand(cards)
  const byId = new Map(cards.map((c) => [c.id, c]))
  const kept = order.flatMap((id) => byId.get(id) ?? [])
  const known = new Set(order)
  const arrived = cards.filter((c) => !known.has(c.id)).sort((a, b) => a.id - b.id)
  return [...kept, ...arrived]
}

/**
 * The order after moving one card so it sits before `before` (or at the end when `before` is
 * null). Returns null when the result is the sorted order, so the hand counts as sorted again.
 */
export function moveCard(
  arranged: readonly Card[],
  cardId: CardId,
  before: CardId | null,
): CardId[] | null {
  const card = arranged.find((c) => c.id === cardId)
  if (!card || cardId === before) return orderOf(arranged)
  const rest = arranged.filter((c) => c.id !== cardId)
  const at = before === null ? rest.length : rest.findIndex((c) => c.id === before)
  rest.splice(at === -1 ? rest.length : at, 0, card)
  return orderOf(rest)
}

/** The ids in order, or null when that is just the sorted order. */
export function orderOf(arranged: readonly Card[]): CardId[] | null {
  const sorted = sortHand(arranged)
  return sorted.every((c, i) => c.id === arranged[i].id) ? null : arranged.map((c) => c.id)
}
