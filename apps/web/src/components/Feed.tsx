import type { FeedEvent, PublicPlayer } from '@canasta/engine'
import { describeEvent } from '../feed'
import type { SeatNotice } from '../gameState'
import styles from './Table.module.css'

const SHOWN = 8

export function Feed({
  events,
  notices,
  players,
}: {
  events: FeedEvent[]
  notices: SeatNotice[]
  players: PublicPlayer[]
}) {
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? 'a player'
  return (
    <section className={styles.feed} aria-label="What happened">
      {/* One live region, always present, so screen readers announce each new notice once. */}
      <div role="status">
        {notices.map((n) => (
          <p key={n.id} className={styles.notice}>
            The host made a rejoin link for {nameOf(n.playerId)}'s seat.
          </p>
        ))}
      </div>
      {/* Newest first. */}
      <ul>
        {events
          .slice(-SHOWN)
          .reverse()
          .map((event, i) => (
            <li key={events.length - i}>{describeEvent(event, players)}</li>
          ))}
      </ul>
    </section>
  )
}
