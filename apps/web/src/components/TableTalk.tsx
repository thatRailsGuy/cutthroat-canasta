import type { FeedEvent, PublicPlayer, QuitPlayer } from '@canasta/engine'
import type { ChatLine } from '@canasta/server/protocol'
import { useEffect, useLayoutEffect, useRef, type FormEvent } from 'react'
import { CHAT_COUNT_FROM, CHAT_LENGTH, cleanChat, mergeTalk } from '../chat'
import { describeEvent } from '../feed'
import type { SeatNotice } from '../gameState'
import styles from './Table.module.css'

/** One name colour per seat, matching the avatars, but dark enough to read as text. */
const SEAT_INKS = [
  styles.inkTeal,
  styles.inkGold,
  styles.inkRed,
  styles.inkBlue,
  styles.inkPlum,
  styles.inkAvocado,
  styles.inkPink,
  styles.inkWalnut,
]

/** How close to the bottom (px) still counts as reading the newest lines. */
const STICK_WITHIN = 24

export interface TalkControls {
  /** What the player is typing. */
  text: string
  onType(text: string): void
  /** Returns false if the line wasn't sent, so the text stays in the input. */
  onSend(text: string): boolean
  /** Table talk is on screen: every line so far counts as seen. */
  onRead(): void
}

export interface TableTalkProps {
  events: readonly FeedEvent[]
  /** The deal the events belong to, or null in the lobby. */
  deal: { game: number; round: number; redeals: number } | null
  chat: readonly ChatLine[]
  notices: readonly SeatNotice[]
  players: readonly PublicPlayer[]
  /** Players waiting to be dealt in, who sit after the last seat. */
  waiting?: readonly { id: string }[]
  quit?: readonly QuitPlayer[]
  playerId: string | null
  offline: boolean
  /** False while the panel is out of sight, such as in a closed sheet. */
  visible?: boolean
  /** Without it there is no input, as in the tutorial. */
  talk?: TalkControls
}

/**
 * The game events of this deal and the players' chat, oldest first, with an input to talk to
 * the table. The list keeps to the newest line unless the player has scrolled up to read.
 */
export function TableTalk({
  events,
  deal,
  chat,
  notices,
  players,
  waiting = [],
  quit = [],
  playerId,
  offline,
  visible = true,
  talk,
}: TableTalkProps) {
  const nameOf = (id: string) => [...players, ...quit].find((p) => p.id === id)?.name ?? 'a player'
  const seats = [...players, ...waiting]
  const items = mergeTalk(events, chat, deal)
  const listRef = useRef<HTMLUListElement>(null)
  const atBottomRef = useRef(true)
  const newest = items.at(-1)
  const yoursLast = newest?.kind === 'chat' && newest.line.playerId === playerId

  useLayoutEffect(() => {
    const list = listRef.current
    // Your own line always brings you back down to it.
    if (list && (atBottomRef.current || yoursLast)) list.scrollTop = list.scrollHeight
  }, [newest?.key, yoursLast, visible])

  const onRead = talk?.onRead
  useEffect(() => {
    if (visible) onRead?.()
  }, [visible, chat, onRead])

  const cleaned = talk ? cleanChat(talk.text) : ''
  const tooLong = cleaned.length > CHAT_LENGTH
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!talk || !cleaned || tooLong) return
    talk.onSend(cleaned)
  }

  return (
    <section className={styles.feed} aria-label="Table talk">
      {/* One live region, always present, so screen readers announce each new notice once. */}
      <div role="status">
        {notices.map((n) => (
          <p key={n.id} className={styles.notice}>
            The host made a rejoin link for {nameOf(n.playerId)}'s seat.
          </p>
        ))}
      </div>
      <ul
        ref={listRef}
        className={styles.talk}
        role="log"
        onScroll={(e) => {
          const list = e.currentTarget
          atBottomRef.current =
            list.scrollHeight - list.scrollTop - list.clientHeight <= STICK_WITHIN
        }}
      >
        {items.map((item) => {
          if (item.kind === 'event') {
            return (
              <li key={item.key} className={styles.event}>
                {describeEvent(item.event, players, quit)}
              </li>
            )
          }
          const { line } = item
          const mine = line.playerId === playerId
          const seat = seats.findIndex((p) => p.id === line.playerId)
          return (
            <li key={item.key} className={`${styles.say} ${mine ? styles.mine : ''}`}>
              <b className={seat < 0 ? undefined : SEAT_INKS[seat % SEAT_INKS.length]}>
                {mine ? 'You' : line.name}:
              </b>{' '}
              {line.text}
            </li>
          )
        })}
      </ul>
      {talk && (
        <>
          <form className={styles.sayForm} onSubmit={submit} autoComplete="off">
            <input
              value={talk.text}
              onChange={(e) => talk.onType(e.target.value)}
              placeholder="Say something"
              aria-label="Message to the table"
              enterKeyHint="send"
            />
            <button type="submit" disabled={offline || !cleaned || tooLong}>
              Send
            </button>
          </form>
          <p className={`${styles.sayCount} ${tooLong ? styles.over : ''}`} aria-live="polite">
            {cleaned.length >= CHAT_COUNT_FROM ? `${cleaned.length} / ${CHAT_LENGTH}` : ''}
          </p>
        </>
      )}
    </section>
  )
}
