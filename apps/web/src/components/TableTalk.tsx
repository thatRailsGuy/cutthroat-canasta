import type { FeedEvent, PublicPlayer, QuitPlayer } from '@canasta/engine'
import type { ChatLine } from '@canasta/server/protocol'
import { useEffect, useLayoutEffect, useRef, type FormEvent } from 'react'
import { CHAT_COUNT_FROM, CHAT_LENGTH, cleanChat, mergeTalk } from '../chat'
import { describeEvent } from '../feed'
import type { SeatNotice } from '../gameState'
import { useChatSound, useSoundLevel } from '../soundLevel'
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
      <div className={styles.feedHead}>
        <span aria-hidden="true">Table talk</span>
        {talk && <ChatBell />}
      </div>
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

/** The bell on the header that turns the clink for new chat lines on or off. */
function ChatBell() {
  const [on, setOn] = useChatSound()
  const [level] = useSoundLevel()
  // With all sound off it can't clink, so the bell shows that and keeps the choice for later.
  const muted = level === 0
  return (
    <button
      type="button"
      className={`${styles.chatBell} ${muted ? styles.muted : ''}`}
      aria-label={muted ? 'Chat sound, off because all sound is off' : 'Chat sound'}
      aria-pressed={muted ? undefined : on}
      aria-disabled={muted || undefined}
      title={
        muted
          ? 'All sound is off. Turn it on with the speaker button.'
          : `Chat sound: ${on ? 'on' : 'off'}`
      }
      onClick={() => {
        if (!muted) setOn(!on)
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z" />
        <path d="M10 20.5a2 2 0 0 0 4 0" />
        {on && !muted ? (
          <path d="M2.5 9a9 9 0 0 1 2.5-5M21.5 9a9 9 0 0 0-2.5-5" />
        ) : (
          <path d="M3 3l18 18" />
        )}
      </svg>
    </button>
  )
}
