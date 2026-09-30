import type { Card, FeedEvent, NaturalRank } from '@canasta/engine'

/** A moment on the table worth animating, worked out from new feed events. */
export type TableEffect =
  /** A card goes from the stock to a player's hand. `card` is set when it is yours. */
  | { kind: 'draw'; playerId: string; card: Card | null }
  /** The pile goes into a player's hand. `top` is the card that was on top. */
  | { kind: 'pickup'; playerId: string; count: number; top: Card | null }
  /** A card goes from a player's hand to the top of the pile. */
  | { kind: 'discard'; playerId: string; card: Card }
  | { kind: 'canasta'; playerId: string; rank: NaturalRank; natural: boolean }
  | { kind: 'red3'; playerId: string; count: number }

/**
 * More new events than this at once means a reconnect or a catch-up, not something the player
 * just watched happen, so nothing is animated.
 */
export const MAX_ANIMATED_EVENTS = 3

export interface EffectContext {
  /** Your id, so your own draw can show its card. */
  youId: string | null
  /** The card you drew this turn, from `you.drawnCard`. */
  drawn: Card | null
  /** The top of the pile before these events, for a pickup's first card. */
  previousTop: Card | null
}

/** The effects for events that just arrived, in the order they happened. */
export function effectsFor(events: readonly FeedEvent[], ctx: EffectContext): TableEffect[] {
  if (events.length > MAX_ANIMATED_EVENTS) return []
  const effects: TableEffect[] = []
  for (const event of events) {
    switch (event.type) {
      case 'drewStock':
        effects.push({
          kind: 'draw',
          playerId: event.playerId,
          card: event.playerId === ctx.youId ? ctx.drawn : null,
        })
        if (event.red3s.length > 0) {
          effects.push({ kind: 'red3', playerId: event.playerId, count: event.red3s.length })
        }
        break
      case 'pickedUpPile':
        effects.push({
          kind: 'pickup',
          playerId: event.playerId,
          count: event.count,
          top: ctx.previousTop,
        })
        if (event.red3s?.length) {
          effects.push({ kind: 'red3', playerId: event.playerId, count: event.red3s.length })
        }
        for (const c of event.canastas ?? []) {
          effects.push({ kind: 'canasta', playerId: event.playerId, ...c })
        }
        break
      case 'melded':
        for (const c of event.canastas ?? []) {
          effects.push({ kind: 'canasta', playerId: event.playerId, ...c })
        }
        break
      case 'discarded':
        effects.push({ kind: 'discard', playerId: event.playerId, card: event.card })
        break
    }
  }
  return effects
}
