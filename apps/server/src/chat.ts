import type { Game } from '@canasta/engine'
import { CHAT_LOG_SIZE, type ChatLine } from './protocol'

/** Each player can send this many lines in any CHAT_WINDOW_MS. */
export const CHAT_BURST = 5
export const CHAT_WINDOW_MS = 10_000

/** The log with `line` added, keeping only the newest CHAT_LOG_SIZE lines. */
export function appendLine(log: readonly ChatLine[], line: ChatLine): ChatLine[] {
  return [...log, line].slice(-CHAT_LOG_SIZE)
}

/**
 * Applies the rate limit to one player's recent send times. Returns the times to keep, with
 * `now` added if the send is allowed, or null if the player must wait.
 */
export function allowSend(times: readonly number[], now: number): number[] | null {
  const recent = times.filter((t) => now - t < CHAT_WINDOW_MS)
  if (recent.length >= CHAT_BURST) return null
  return [...recent, now]
}

/**
 * Stamps a line from `playerId`, anchored after the current deal's events so far. Returns null
 * if the player has no seat and isn't waiting for one.
 */
export function stampLine(
  game: Game,
  playerId: string,
  text: string,
  id: number,
  at: number,
): ChatLine | null {
  const { players, waiting = [], round } = game
  const sender = [...players, ...waiting].find((p) => p.id === playerId)
  if (!sender) return null
  const anchor = round
    ? { round: round.number, redeals: round.redeals ?? 0, after: round.feed.length }
    : { round: null, redeals: 0, after: 0 }
  return { id, playerId, name: sender.name, text, at, anchor }
}
