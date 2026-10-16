import type { HOST_AWAY_AFTER_MS, hostAway as serverHostAway } from '@canasta/server/protocol'
import { useEffect, useState } from 'react'

// Type-only imports keep server code out of the bundle, so these are copies. The annotations
// fail the typecheck if the constant or the function's signature ever differs from the
// server's; the function's body must be kept the same by hand.
const HOST_AWAY_MS: typeof HOST_AWAY_AFTER_MS = 30_000

/** The server's `hostAway` (protocol.ts): whether another player can stand in for the host. */
export const hostAway: typeof serverHostAway = (hostId, connected, away) => {
  if (hostId === null) return true
  if (connected.includes(hostId)) return false
  return (away[hostId] ?? Infinity) >= HOST_AWAY_MS
}

/** The time now, updated every `every` ms while `ticking`: every 15 seconds for "away for 3 minutes". */
export function useNow(ticking: boolean, every = 15_000): number {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!ticking) return
    const timer = setInterval(() => setNow(Date.now()), every)
    return () => clearInterval(timer)
  }, [ticking, every])
  return now
}

/**
 * Whether this player can stand in for the host. `awaySince` comes with each state, so the
 * clock ticks while the host has no connection, and the page finds out when their grace is up.
 */
export function useHostAway(
  hostId: string | null,
  connected: readonly string[],
  awaySince: Readonly<Record<string, number>>,
): boolean {
  const now = useNow(hostId !== null && !connected.includes(hostId))
  const away = Object.fromEntries(Object.entries(awaySince).map(([id, since]) => [id, now - since]))
  return hostAway(hostId, connected, away)
}

/**
 * While the host is away, the whole seconds left in their grace, counted down each second, for
 * "If Ann isn't back in 24 seconds". Null while the host is connected. It stops at 1 rather than
 * 0: whether anyone can stand in yet is `useHostAway`'s to say.
 */
export function useStandInCountdown(
  hostId: string | null,
  connected: readonly string[],
  awaySince: Readonly<Record<string, number>>,
): number | null {
  const since = hostId !== null && !connected.includes(hostId) ? awaySince[hostId] : undefined
  const now = useNow(since !== undefined, 1_000)
  if (since === undefined) return null
  // The clock may not have ticked since the host went, so `now` can be older than `since`.
  const left = Math.ceil((HOST_AWAY_MS - (now - since)) / 1000)
  return Math.min(HOST_AWAY_MS / 1000, Math.max(1, left))
}
