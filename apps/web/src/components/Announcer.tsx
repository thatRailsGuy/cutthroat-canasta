import type { PlayerView } from '@canasta/engine'
import type { ChatLine } from '@canasta/server/protocol'
import { useEffect, useRef } from 'react'
import { announcements, chatAnnouncement } from '../announce'

export interface AnnouncerProps {
  view: PlayerView | null
  playerId: string | null
  /** The newest chat line that came in live. */
  chatHeard: ChatLine | null
  /**
   * Also say other players' moves and chat lines. On for a phone, where the event log sits in
   * a closed sheet and so can't announce anything itself.
   */
  events: boolean
}

/**
 * A screen-reader-only live region for the game: the turn coming to you, the round and the
 * game ending, and on a phone what the others do. It lives above the table, which remounts
 * with each deal, because a live region has to be in the page before its text changes.
 */
export function Announcer({ view, playerId, chatHeard, events }: AnnouncerProps) {
  const regionRef = useRef<HTMLDivElement>(null)
  const prevView = useRef(view)
  // The line already heard when this mounted isn't said again.
  const saidChat = useRef(chatHeard)

  const say = (text: string) => {
    const region = regionRef.current
    if (!region) return
    // A trailing space that alternates makes the same words count as a change and be said again.
    region.textContent = region.textContent === text ? `${text}\u00a0` : text
  }

  useEffect(() => {
    if (!view) return
    const lines = announcements(prevView.current, view, playerId, { events })
    prevView.current = view
    if (lines.length > 0) say(lines.join(' '))
    // Only a new view is news; a change of layout doesn't repeat it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  useEffect(() => {
    if (!chatHeard || chatHeard === saidChat.current) return
    saidChat.current = chatHeard
    const text = events ? chatAnnouncement(chatHeard, playerId) : null
    if (text) say(text)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatHeard])

  return <div ref={regionRef} role="status" className="sr-only" />
}
