import { MAX_PLAYERS } from '@canasta/engine'
import type { OpenTable } from './protocol'
import { blockedAddresses, type RoomState } from './room'

/** How often a listed room reports in, so the directory knows it's still there. */
export const REFRESH_MS = 60_000
/** A listing that hasn't been reported for this long drops off, such as a room that crashed. */
export const LISTING_TTL_MS = 150_000
/** The most tables the home page shows. */
export const MAX_LISTED = 20

/** What a room sends the directory. `blocked` stays on the server. */
export interface Listing extends OpenTable {
  blocked: string[]
}

export interface DirectoryEntry extends Listing {
  /** When the room was first listed, so the newest table goes first. */
  listedAt: number
  /** When the room last reported in. */
  seenAt: number
}

/**
 * The room's line on the home page, or null if it shouldn't have one: it's private, past the
 * lobby, full, or its host is offline, so nobody would be there to start the game.
 */
export function tableListing(state: RoomState, connected: readonly string[]): Listing | null {
  const { game, hostId } = state
  if (!state.public || game.status !== 'lobby') return null
  if (!hostId || !connected.includes(hostId)) return null
  if (game.players.length >= MAX_PLAYERS) return null
  const host = game.players.find((p) => p.id === hostId)
  if (!host) return null
  return {
    code: state.code,
    host: host.name,
    others: game.players.filter((p) => p.id !== hostId).map((p) => p.name),
    seats: game.players.length,
    maxSeats: MAX_PLAYERS,
    blocked: blockedAddresses(state),
  }
}

/** Live entries, newest first, without the ones that blocked the caller. */
export function openTables(
  entries: Iterable<DirectoryEntry>,
  now: number,
  isBlocked: (entry: DirectoryEntry) => boolean,
): OpenTable[] {
  return [...entries]
    .filter((e) => now - e.seenAt <= LISTING_TTL_MS && !isBlocked(e))
    .sort((a, b) => b.listedAt - a.listedAt)
    .slice(0, MAX_LISTED)
    .map(({ code, host, others, seats, maxSeats }) => ({ code, host, others, seats, maxSeats }))
}
