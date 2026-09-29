import { STALE_AFTER_MS } from './protocol'

/** The latest time (ms) a socket was heard from: a message, or a ping the runtime answered. */
export function lastSeen(seenAt: number, autoResponseAt: Date | null): number {
  return Math.max(seenAt, autoResponseAt?.getTime() ?? 0)
}

export function isStale(lastSeenAt: number, now: number): boolean {
  return now - lastSeenAt > STALE_AFTER_MS
}
