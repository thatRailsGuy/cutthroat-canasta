import type { PlayerView } from '@canasta/engine'
import { useSyncExternalStore } from 'react'

/**
 * From this many players the table is crowded: opponents' panels shrink to one line of meld
 * chips, and the score pad lists players down the page instead of across it.
 */
export const CROWDED_TABLE = 5

export function isCrowded(view: PlayerView): boolean {
  return view.players.length >= CROWDED_TABLE
}

/** A phone held upright. The CSS modules use the same width in their `@media` rules. */
export const PHONE_QUERY = '(max-width: 600px)'

/**
 * On a phone the table is laid out for one thumb: opponents shrink to tiles, the hand sits in
 * overlapping rows above the buttons, and the score pad and table talk move into a sheet.
 */
export function usePhone(): boolean {
  return useSyncExternalStore(subscribePhone, isPhone, () => false)
}

function phoneQuery(): MediaQueryList | undefined {
  return typeof window === 'undefined' ? undefined : window.matchMedia?.(PHONE_QUERY)
}

function subscribePhone(onChange: () => void): () => void {
  const query = phoneQuery()
  query?.addEventListener('change', onChange)
  return () => query?.removeEventListener('change', onChange)
}

function isPhone(): boolean {
  return phoneQuery()?.matches ?? false
}
