import type { PlayerView } from '@canasta/engine'

/**
 * From this many players the table is crowded: opponents' panels shrink to one line of meld
 * chips, and the score pad lists players down the page instead of across it.
 */
export const CROWDED_TABLE = 5

export function isCrowded(view: PlayerView): boolean {
  return view.players.length >= CROWDED_TABLE
}
