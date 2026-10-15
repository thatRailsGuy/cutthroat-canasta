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

/** The time now, updated every 15 seconds while `ticking`, for "away for 3 minutes". */
export function useNow(ticking: boolean): number {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!ticking) return
    const timer = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(timer)
  }, [ticking])
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
