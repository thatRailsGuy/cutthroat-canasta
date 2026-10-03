import {
  DIRTY_CANASTA_BONUS,
  CLEAN_CANASTA_BONUS,
  RED_THREE_BONUS,
  type Card,
  type CardId,
  type PlayerView,
} from '@canasta/engine'
import { useLayoutEffect, useRef } from 'react'
import { effectsFor, type TableEffect } from '../effects'
import cardStyles from './Card.module.css'
import styles from './TableEffects.module.css'

/** What the table looked like when the effects last ran. */
interface Seen {
  round: number
  feedLength: number
  top: Card | null
  hand: ReadonlySet<CardId>
  /** Where each card in your hand was, since a discarded card is gone by the next view. */
  handRects: ReadonlyMap<CardId, DOMRect>
}

const FLIGHT_MS = 750
const STAGGER_MS = 70
/** A big pickup flies this many cards; the rest are already in the hand. */
const MAX_FLIGHTS = 12

/**
 * Animates what just happened on the table: cards flying from the stock or the pile into a
 * hand, a stamp on a new canasta, and a pop for a red 3. It watches the round's feed and plays
 * the effects over the table, on a layer the page ignores (no pointer events, hidden from
 * screen readers). With reduced motion, or no Web Animations API, it does nothing.
 */
export function TableEffects({ view }: { view: PlayerView }) {
  const layer = useRef<HTMLDivElement>(null)
  const seen = useRef<Seen | null>(null)

  useLayoutEffect(() => {
    const round = view.round
    const root = layer.current
    if (!round || !root) return
    const previous = seen.current
    const hand = new Set(view.you?.hand.map((c) => c.id) ?? [])
    seen.current = {
      round: round.number,
      feedLength: round.feed.length,
      top: round.discardTop,
      hand,
      handRects: handRects(),
    }
    if (!previous || previous.round !== round.number) return
    if (round.feed.length <= previous.feedLength || !canAnimate()) return

    const you = view.you
    const drawn = you?.hand.find((c) => c.id === you.drawnCard) ?? null
    const effects = effectsFor(round.feed.slice(previous.feedLength), {
      youId: you?.id ?? null,
      drawn,
      previousTop: previous.top,
    })
    const arrived = [...hand].filter((id) => !previous.hand.has(id))
    let delay = 0
    for (const effect of effects) {
      const hasMelds = view.players.find((p) => p.id === effect.playerId)?.melds.length !== 0
      delay = play(root, effect, {
        isYou: effect.playerId === you?.id,
        arrived,
        handRects: previous.handRects,
        hasMelds,
        delay,
      })
    }
  }, [view])

  return <div ref={layer} className={styles.layer} aria-hidden="true" />
}

function handRects(): Map<CardId, DOMRect> {
  const rects = new Map<CardId, DOMRect>()
  for (const card of document.querySelectorAll<HTMLElement>('[data-hand] [data-card-id]')) {
    rects.set(Number(card.dataset.cardId), card.getBoundingClientRect())
  }
  return rects
}

function canAnimate(): boolean {
  if (typeof Element === 'undefined' || typeof Element.prototype.animate !== 'function') {
    return false
  }
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

interface PlayContext {
  isYou: boolean
  /** Cards that are new in your hand since the last view. */
  arrived: CardId[]
  /** Where your hand's cards were in the last view. */
  handRects: ReadonlyMap<CardId, DOMRect>
  /** The player has melded, so a red 3 counts for them rather than against. */
  hasMelds: boolean
  /** When this effect may start, in ms, so effects play one after another. */
  delay: number
}

/** Plays one effect and returns when the next may start. */
function play(root: HTMLElement, effect: TableEffect, ctx: PlayContext): number {
  const seat = document.querySelector(`[data-player-id="${CSS.escape(effect.playerId)}"]`)
  switch (effect.kind) {
    case 'draw': {
      const from = document.querySelector('[data-stock] [data-back]:last-child')
      if (!from) return ctx.delay
      const card = effect.card
        ? document.querySelector(`[data-hand] [data-card-id="${effect.card.id}"]`)
        : null
      if (card) {
        fly(root, from, card, { delay: ctx.delay, face: faceOf(card), back: backOf(from) })
      } else {
        const target = handTarget(seat)
        if (target) fly(root, from, target, { delay: ctx.delay, back: backOf(from) })
      }
      return ctx.delay + FLIGHT_MS
    }
    case 'pickup': {
      const from = document.querySelector('[data-pile]')
      if (!from) return ctx.delay
      let flights = 0
      if (ctx.isYou) {
        for (const id of ctx.arrived.slice(0, MAX_FLIGHTS)) {
          const card = document.querySelector(`[data-hand] [data-card-id="${id}"]`)
          if (!card) continue
          fly(root, from, card, { delay: ctx.delay + flights * STAGGER_MS, face: faceOf(card) })
          flights++
        }
      } else {
        const target = handTarget(seat)
        const shown = target ? Math.min(effect.count, 5) : 0
        for (; flights < shown; flights++) {
          fly(root, from, target!, { delay: ctx.delay + flights * STAGGER_MS, face: blank() })
        }
      }
      return ctx.delay + FLIGHT_MS + Math.max(flights - 1, 0) * STAGGER_MS
    }
    case 'discard': {
      const to = document.querySelector(`[data-pile] [data-card-id="${effect.card.id}"]`)
      const from = ctx.isYou ? ctx.handRects.get(effect.card.id) : handTarget(seat)
      if (!to || !from) return ctx.delay
      // A discarded wild freezes the pile and lies sideways on it.
      const turn = to.closest('[data-sideways]') ? 90 : 0
      const back = ctx.isYou ? undefined : document.querySelector('[data-back]')
      fly(root, from, to, {
        delay: ctx.delay,
        face: faceOf(to),
        back: back ? backOf(back) : undefined,
        fromScale: true,
        turn,
      })
      return ctx.delay + FLIGHT_MS
    }
    case 'canasta': {
      const melds = seat?.querySelectorAll(`[data-rank="${effect.rank}"][data-canasta]`)
      const meld = melds?.[melds.length - 1]
      if (!meld) return ctx.delay
      const bonus = effect.natural ? CLEAN_CANASTA_BONUS : DIRTY_CANASTA_BONUS
      mark(root, meld, styles.stamp, `${effect.natural ? 'Clean' : 'Dirty'}! +${bonus}`, {
        delay: ctx.delay,
        gleam: true,
      })
      return ctx.delay + 600
    }
    case 'red3': {
      const target = seat?.querySelector('[data-red3s]')
      if (!target) return ctx.delay
      const points = effect.count * RED_THREE_BONUS
      mark(root, target, styles.pop, ctx.hasMelds ? `+${points}` : 'Red 3!', { delay: ctx.delay })
      return ctx.delay + 400
    }
  }
}

/** Where an opponent's cards go: the last back in their little fan, or the count itself. */
function handTarget(seat: Element | null): Element | null {
  const target = seat?.querySelector('[data-hand-target]')
  return target?.querySelector('[data-back]:last-child') ?? target ?? null
}

/** A copy of a card, stripped of its selected and just-drawn looks, to fly in its place. */
function faceOf(card: Element): HTMLElement {
  const face = card.cloneNode(true) as HTMLElement
  face.classList.remove(cardStyles.selected, cardStyles.fresh)
  face.removeAttribute('data-card-id')
  face.setAttribute('tabindex', '-1')
  return face
}

function backOf(back: Element): HTMLElement {
  const copy = back.cloneNode(true) as HTMLElement
  copy.removeAttribute('data-back')
  return copy
}

/** A plain card front for an opponent's pickup, whose cards you don't get to see. */
function blank(): HTMLElement {
  const card = document.createElement('span')
  card.className = cardStyles.card
  return card
}

/**
 * Flies a card from `from` to `to` along an arc, laid out at a normal card's size and scaled
 * to fit `to` as it lands. The card it lands on is hidden until its copy gets there. With a
 * back, the card starts face down and turns over in the air. `fromScale` starts it at the
 * size of `from` (a small back in an opponent's fan), and `turn` lands it rotated that many
 * degrees.
 */
function fly(
  root: HTMLElement,
  from: Element | DOMRect,
  to: Element,
  opts: {
    delay: number
    face?: HTMLElement
    back?: HTMLElement
    fromScale?: boolean
    turn?: number
  },
) {
  const a = from instanceof Element ? from.getBoundingClientRect() : from
  const b = to.getBoundingClientRect()
  if (b.width === 0 || a.width === 0) return
  const size = cardSize() ?? b
  const flight = document.createElement('div')
  flight.className = styles.flight
  Object.assign(flight.style, {
    left: `${b.left + b.width / 2 - size.width / 2}px`,
    top: `${b.top + b.height / 2 - size.height / 2}px`,
    width: `${size.width}px`,
    height: `${size.height}px`,
  })
  const turner = document.createElement('div')
  turner.className = styles.turner
  for (const [side, className] of [
    [opts.face, styles.front],
    [opts.back, styles.backSide],
  ] as const) {
    if (!side) continue
    const wrap = document.createElement('div')
    wrap.className = className
    wrap.append(side)
    turner.append(wrap)
  }
  flight.append(turner)
  root.append(flight)

  const dx = a.left + a.width / 2 - (b.left + b.width / 2)
  const dy = a.top + a.height / 2 - (b.top + b.height / 2)
  const turn = opts.turn ?? 0
  // A card turned sideways fits its box the other way round.
  const end = (turn % 180 === 0 ? b.width : b.height) / size.width
  const start = opts.fromScale ? a.width / size.width : 1
  const mid = (start + end) / 2
  const hideTarget = opts.face !== undefined && to.hasAttribute('data-card-id')
  const target = to as HTMLElement
  if (hideTarget) target.style.visibility = 'hidden'

  const timing: KeyframeAnimationOptions = {
    duration: FLIGHT_MS,
    delay: opts.delay,
    fill: 'backwards',
  }
  const move = flight.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${start})`, easing: 'ease-out' },
      {
        transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 70}px) scale(${mid}) rotate(${turn / 2 + 7}deg)`,
        offset: 0.5,
        easing: 'ease-in',
      },
      { transform: `scale(${end}) rotate(${turn - 2}deg)`, offset: 0.82, easing: 'ease-out' },
      { transform: `translateY(-8px) scale(${end}) rotate(${turn - 1}deg)`, offset: 0.91 },
      { transform: `scale(${end}) rotate(${turn}deg)` },
    ],
    timing,
  )
  if (opts.face && opts.back) {
    turner.animate(
      [
        { transform: 'rotateY(180deg)' },
        { transform: 'rotateY(180deg)', offset: 0.2, easing: 'ease-in-out' },
        { transform: 'rotateY(0deg)', offset: 0.6 },
        { transform: 'rotateY(0deg)' },
      ],
      timing,
    )
  } else if (opts.back) {
    turner.style.transform = 'rotateY(180deg)'
  }
  const done = () => {
    flight.remove()
    if (hideTarget) target.style.visibility = ''
  }
  move.finished.then(done, done)
}

/** A normal card's size, read from the stock's top back. */
function cardSize(): DOMRect | null {
  return document.querySelector('[data-stock] [data-back]')?.getBoundingClientRect() ?? null
}

/** Lays a stamp or a pop over an element; it removes itself when its animation ends. */
function mark(
  root: HTMLElement,
  over: Element,
  className: string,
  text: string,
  opts: { delay: number; gleam?: boolean },
) {
  const r = over.getBoundingClientRect()
  const box = document.createElement('div')
  box.className = styles.mark
  Object.assign(box.style, {
    left: `${r.left}px`,
    top: `${r.top}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
  })
  box.style.setProperty('--delay', `${opts.delay}ms`)
  if (opts.gleam) {
    const gleam = document.createElement('div')
    gleam.className = styles.gleam
    box.append(gleam)
  }
  const label = document.createElement('div')
  label.className = className
  label.textContent = text
  box.append(label)
  root.append(box)
  label.addEventListener('animationend', () => box.remove(), { once: true })
  // A backstop, in case the animation never runs (a hidden tab).
  setTimeout(() => box.remove(), opts.delay + 4000)
}
