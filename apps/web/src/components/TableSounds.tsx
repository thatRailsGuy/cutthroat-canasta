import type { PlayerView } from '@canasta/engine'
import { useEffect, useRef } from 'react'
import { listenForUnlock, playCues } from '../soundPlayer'
import { audible, cuesFor, snapshotOf, type SoundSnapshot } from '../sounds'
import { useSoundLevel } from '../soundLevel'

/**
 * Plays sounds for what just happened at the table, from the same feed events as the table's
 * animations. It renders nothing. It sits above the table, which remounts with each deal, so
 * it hears the deal itself: your turn at the start of a round, and the end of the last one.
 * While the connection is down it forgets what it saw, so the catch-up after a reconnect
 * stays quiet.
 */
export function TableSounds({ view, live }: { view: PlayerView; live: boolean }) {
  const [level] = useSoundLevel()
  const seen = useRef<SoundSnapshot | null>(null)
  // The view from before the connection dropped, which is still showing when it comes back.
  const stale = useRef<PlayerView | null>(null)

  useEffect(listenForUnlock, [])

  useEffect(() => {
    if (!live) {
      seen.current = null
      stale.current = view
      return
    }
    if (view === stale.current) return
    stale.current = null
    const previous = seen.current
    seen.current = snapshotOf(view)
    playCues(cuesFor(previous, view).filter((cue) => audible(cue, level)))
    // Only a new view plays sounds; moving the slider doesn't replay the last one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, live])

  return null
}
