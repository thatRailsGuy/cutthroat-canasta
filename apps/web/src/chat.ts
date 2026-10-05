import type { FeedEvent } from '@canasta/engine'
import type { CHAT_LOG_SIZE, ChatLine, MAX_CHAT_LENGTH } from '@canasta/server/protocol'

// Type-only imports keep server code out of the bundle. Annotating each copy with the server
// constant's literal type makes the typecheck fail if the two ever differ.
export const CHAT_LENGTH: typeof MAX_CHAT_LENGTH = 200
export const CHAT_LINES: typeof CHAT_LOG_SIZE = 50
/** The input shows a character count from this length on. */
export const CHAT_COUNT_FROM = 160

/** Cleans text the way the server will, so the input can count and block what it would refuse. */
export function cleanChat(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/(?!‍)[\p{Cc}\p{Cf}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export type TalkItem =
  { kind: 'event'; key: string; event: FeedEvent } | { kind: 'chat'; key: string; line: ChatLine }

/**
 * Where the events worth showing start: the last finished turn and the turn being played.
 * Older plays drop out, so players have to remember the discards themselves.
 */
export function recentStart(events: readonly FeedEvent[]): number {
  const ends = events.flatMap((e, i) => (e.type === 'discarded' || e.type === 'wentOut' ? [i] : []))
  return ends.length < 2 ? 0 : ends[ends.length - 2] + 1
}

/**
 * Table talk, oldest first: the recent game events (see `recentStart`) with chat lines placed
 * among them by their anchors. Lines from the lobby, an earlier deal, or before the recent
 * events go first. `deal` is null in the lobby.
 */
export function mergeTalk(
  events: readonly FeedEvent[],
  chat: readonly ChatLine[],
  deal: { round: number; redeals: number } | null,
): TalkItem[] {
  const inDeal = (line: ChatLine) =>
    deal !== null && line.anchor.round === deal.round && line.anchor.redeals === deal.redeals
  const say = (line: ChatLine): TalkItem => ({ kind: 'chat', key: `c${line.id}`, line })
  const start = recentStart(events)
  const items = chat.filter((l) => !inDeal(l) || l.anchor.after <= start).map(say)
  const here = chat.filter((l) => inDeal(l) && l.anchor.after > start)
  events.forEach((event, i) => {
    if (i < start) return
    items.push(...here.filter((l) => l.anchor.after === i).map(say))
    items.push({ kind: 'event', key: `e${i}`, event })
  })
  items.push(...here.filter((l) => l.anchor.after >= events.length).map(say))
  return items
}
