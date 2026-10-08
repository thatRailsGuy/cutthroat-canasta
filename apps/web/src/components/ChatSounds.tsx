import type { ChatLine } from '@canasta/server/protocol'
import { useEffect, useRef } from 'react'
import { listenForUnlock, playCues } from '../soundPlayer'
import { audible, clinkDue, type Cue } from '../sounds'
import { useChatSound, useSoundLevel } from '../soundLevel'

const CLINK: Cue = { sound: 'chat', mine: true }

/**
 * Clinks a glass when someone else's chat line comes in. It renders nothing. Only lines that
 * come in live count (`chatHeard`), so the backlog on joining or reconnecting stays quiet. A
 * burst of lines clinks once, and the Off step silences it whatever its own switch says.
 */
export function ChatSounds({ heard, playerId }: { heard: ChatLine | null; playerId: string }) {
  const [level] = useSoundLevel()
  const [on] = useChatSound()
  const lastAt = useRef<number | null>(null)
  // The line already heard when this mounted doesn't play again.
  const played = useRef(heard)

  useEffect(listenForUnlock, [])

  useEffect(() => {
    if (!heard || heard === played.current) return
    played.current = heard
    if (heard.playerId === playerId || !on || !audible(CLINK, level)) return
    const now = performance.now()
    if (!clinkDue(lastAt.current, now)) return
    lastAt.current = now
    playCues([CLINK])
    // Only a new line plays; changing the settings doesn't replay the last one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heard])

  return null
}
