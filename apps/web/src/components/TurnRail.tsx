import type { PlayerView, PublicPlayer } from '@canasta/engine'
import { Fragment } from 'react'
import { CROWDED_TABLE } from '../layout'
import { playOrder } from '../turnOrder'
import { Avatar } from './Avatar'
import styles from './TurnRail.module.css'

export interface TurnRailProps {
  view: PlayerView
}

interface Stop {
  player: PublicPlayer
  seat: number
  name: string
  now: boolean
  isNext: boolean
  dealer: boolean
  /** "Playing", "Next", "Dealer", or a mix, joined with dots. */
  notes: string
}

/**
 * The order of play, starting with you. The seats never move; the gold stop moves along them, so
 * you can see who is up, who is next, and how far it is back to you. Up to four players it is
 * one row. A crowded table is a loop like the seats round a table: you at the bottom between
 * the players after and before you, everyone else across the top.
 */
export function TurnRail({ view }: TurnRailProps) {
  const round = view.round!
  const yourSeat = view.players.findIndex((p) => p.id === view.you?.id)
  const n = view.players.length
  const playing = view.status === 'playing'
  const next = (round.current + 1) % n
  const stops: Stop[] = playOrder(view.players, yourSeat).map(({ player, seat }) => {
    const now = playing && seat === round.current
    // With two players the next one is always you, which the line under your name says.
    const isNext = playing && seat === next && seat !== yourSeat
    const dealer = seat === round.dealer
    const notes = [now && 'Playing', isNext && 'Next', dealer && 'Dealer'].filter(Boolean)
    return {
      player,
      seat,
      name: seat === yourSeat ? 'You' : player.name,
      now,
      isNext,
      dealer,
      notes: notes.join(' · '),
    }
  })
  const looped = n >= CROWDED_TABLE
  return (
    <div className={`${styles.rail} ${looped ? styles.looped : ''}`}>
      <span className={styles.label} id="turn-order">
        Turn order
      </span>
      {/* The loop draws the seats out of play order, so screen readers get the list on its own. */}
      <ol className={looped ? styles.srOnly : styles.stops} aria-labelledby="turn-order">
        {stops.map((stop) =>
          looped ? (
            <li key={stop.player.id} aria-current={stop.now ? 'step' : undefined}>
              {stop.notes ? `${stop.name}: ${stop.notes}` : stop.name}
            </li>
          ) : (
            <li
              key={stop.player.id}
              className={stopClass(stop)}
              aria-current={stop.now ? 'step' : undefined}
            >
              <StopBody stop={stop} />
            </li>
          ),
        )}
      </ol>
      {looped ? (
        <Loop stops={stops} />
      ) : (
        <span className={styles.back} aria-hidden="true">
          <svg viewBox="0 0 34 26" fill="none">
            <path d="M4 6h18a7 7 0 0 1 0 14H8" />
            <path d="M12 15l-5 5 5 5" />
          </svg>
          back to you
        </span>
      )}
    </div>
  )
}

/**
 * Two rows on a dashed track. Play runs left along the bottom from you, up the left side,
 * across the top, and down the right side back to you.
 */
function Loop({ stops }: { stops: Stop[] }) {
  const [you, after, ...rest] = stops
  const before = rest.pop()!
  return (
    <div className={styles.loop} aria-hidden="true">
      <span className={styles.track} />
      <Arrow className={styles.up} d="M11 17V5M6 10l5-5 5 5" />
      <Arrow className={styles.down} d="M11 5v12M6 12l5 5 5-5" />
      <div className={`${styles.loopRow} ${styles.far}`}>
        {rest.map((stop, i) => (
          <Fragment key={stop.player.id}>
            {i > 0 && <Chevron d="M9 5l7 7-7 7" />}
            <div className={stopClass(stop)}>
              <StopBody stop={stop} />
            </div>
          </Fragment>
        ))}
      </div>
      <div className={styles.loopRow}>
        {[after, you, before].map((stop, i) => (
          <Fragment key={stop.player.id}>
            {i > 0 && <Chevron d="M15 5l-7 7 7 7" />}
            <div className={`${stopClass(stop)} ${stop === you ? styles.you : ''}`}>
              <StopBody stop={stop} />
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  )
}

function stopClass(stop: Stop): string {
  return `${styles.stop} ${stop.now ? styles.now : ''} ${stop.isNext ? styles.next : ''} ${stop.notes ? '' : styles.plain}`
}

function StopBody({ stop }: { stop: Stop }) {
  return (
    <>
      <Avatar name={stop.player.name} seat={stop.seat} small dealer={stop.dealer} />
      <span className={styles.text}>
        <span className={styles.name}>{stop.name}</span>
        {stop.notes && <span className={styles.note}>{stop.notes}</span>}
      </span>
    </>
  )
}

function Chevron({ d }: { d: string }) {
  return (
    <svg className={styles.chevron} viewBox="0 0 24 24">
      <path d={d} />
    </svg>
  )
}

function Arrow({ className, d }: { className: string; d: string }) {
  return (
    <svg className={`${styles.side} ${className}`} viewBox="0 0 22 22">
      <path d={d} />
    </svg>
  )
}
