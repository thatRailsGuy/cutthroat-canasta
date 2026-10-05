import type { CardId } from '@canasta/engine'
import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { parseDropTarget, type DropTarget, type DropVerdict } from './drops'

export interface CardDragOptions {
  /** The cards a drag of this card carries: every selected card when it is selected. */
  carry: (cardId: CardId) => CardId[]
  /** What a drop would do; null means the target doesn't take these cards now. */
  judge: (target: DropTarget, cardIds: CardId[]) => DropVerdict | null
  /** An allowed drop. `before` places a card moved within the hand (null: at the end). */
  onDrop: (target: DropTarget, cardIds: CardId[], before: CardId | null) => void
}

/** A mouse drag starts once the pointer moves this far, so a click still selects. */
const MOUSE_SLOP = 6
/** A touch drag starts after a press this long; moving sooner is a scroll. */
const TOUCH_HOLD_MS = 250
const TOUCH_SLOP = 8

interface Drag {
  cardId: CardId
  pointerId: number
  x0: number
  y0: number
  x: number
  y: number
  touch: boolean
  armed: boolean
  timer?: ReturnType<typeof setTimeout>
  started: boolean
  cards: CardId[]
  hand: HTMLElement | null
  ghost?: HTMLElement
  why?: HTMLElement
  marker?: HTMLElement
  offsetX: number
  offsetY: number
  verdicts: Map<HTMLElement, { target: DropTarget; verdict: DropVerdict }>
  over: HTMLElement | null
  before: CardId | null
}

/**
 * Dragging cards out of your hand: onto a meld, the staging area or the pile, or sideways to
 * move a card within the hand. Places that take the cards are marked with `data-drop`; while a
 * drag is on, the ones that would take them get `data-drop-state="can"`, and the one under the
 * pointer `ok` or `no`. The page is touched directly during the drag, and React hears only the
 * drop. Returns the pointerdown handler for a card in the hand.
 */
export function useCardDrag(options: CardDragOptions) {
  const latest = useRef(options)
  useEffect(() => {
    latest.current = options
  })
  const active = useRef<Drag | null>(null)
  // Leaving the table mid-drag takes the ghost and the marks with it.
  useEffect(
    () => () => {
      if (active.current) cleanUp(active.current)
    },
    [],
  )

  return (event: ReactPointerEvent<HTMLElement>, cardId: CardId) => {
    if (event.button > 0 || active.current) return
    const drag: Drag = {
      cardId,
      pointerId: event.pointerId,
      x0: event.clientX,
      y0: event.clientY,
      x: event.clientX,
      y: event.clientY,
      touch: event.pointerType === 'touch',
      armed: event.pointerType !== 'touch',
      started: false,
      cards: [],
      hand: event.currentTarget.closest<HTMLElement>('[data-hand]'),
      offsetX: 0,
      offsetY: 0,
      verdicts: new Map(),
      over: null,
      before: null,
    }
    const rect = event.currentTarget.getBoundingClientRect()
    drag.offsetX = event.clientX - rect.left
    drag.offsetY = event.clientY - rect.top
    active.current = drag

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return
      drag.x = e.clientX
      drag.y = e.clientY
      const moved = Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0)
      if (!drag.started) {
        if (!drag.armed) {
          if (moved > TOUCH_SLOP) stop()
          return
        }
        if (moved < MOUSE_SLOP) return
        start()
      }
      follow()
    }
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return
      if (drag.started) {
        swallowNextClick()
        drop()
      }
      stop()
    }
    const onCancel = (e: PointerEvent) => {
      if (e.pointerId === drag.pointerId) stop()
    }
    // Once a touch drag is on, the finger moves the cards, not the page.
    const onTouchMove = (e: TouchEvent) => {
      if (drag.started) e.preventDefault()
    }
    const onContextMenu = (e: Event) => {
      if (drag.armed && drag.touch) e.preventDefault()
    }

    const start = () => {
      drag.started = true
      const { carry, judge } = latest.current
      drag.cards = carry(cardId)
      for (const el of document.querySelectorAll<HTMLElement>('[data-drop]')) {
        const target = parseDropTarget(el.dataset.drop)
        const verdict = target && judge(target, drag.cards)
        if (!target || !verdict) continue
        drag.verdicts.set(el, { target, verdict })
        if (target.kind !== 'hand') el.dataset.dropState = 'can'
      }
      drag.ghost = makeGhost(drag)
      drag.why = drag.ghost.querySelector<HTMLElement>('.card-ghost-why') ?? undefined
      for (const id of drag.cards) {
        const el = drag.hand?.querySelector<HTMLElement>(`[data-card-id="${id}"]`)
        if (el) el.dataset.lifted = ''
      }
    }

    const follow = () => {
      const ghost = drag.ghost!
      ghost.style.transform = `translate(${drag.x - drag.offsetX}px, ${drag.y - drag.offsetY}px) rotate(-4deg)`
      // The place left behind goes back to "can"; the hand never shows as a place to play.
      if (drag.over && drag.verdicts.get(drag.over)?.target.kind !== 'hand') {
        drag.over.dataset.dropState = 'can'
      }
      drag.over = null
      drag.before = null
      drag.marker?.remove()
      drag.marker = undefined
      delete ghost.dataset.refused
      if (drag.why) drag.why.textContent = ''
      const under = document.elementFromPoint(drag.x, drag.y)?.closest<HTMLElement>('[data-drop]')
      const hit = under && drag.verdicts.get(under)
      if (!under || !hit) return
      drag.over = under
      if (hit.target.kind === 'hand') {
        delete under.dataset.dropState
        placeMarker(drag, under)
        return
      }
      under.dataset.dropState = hit.verdict.ok ? 'ok' : 'no'
      if (!hit.verdict.ok) {
        ghost.dataset.refused = ''
        if (drag.why) drag.why.textContent = hit.verdict.why
      }
    }

    const drop = () => {
      const hit = drag.over && drag.verdicts.get(drag.over)
      if (hit?.verdict.ok) latest.current.onDrop(hit.target, drag.cards, drag.before)
    }

    const stop = () => {
      clearTimeout(drag.timer)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('contextmenu', onContextMenu)
      cleanUp(drag)
      active.current = null
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('contextmenu', onContextMenu)
    if (drag.touch) {
      drag.timer = setTimeout(() => {
        drag.armed = true
        navigator.vibrate?.(10)
        start()
        follow()
      }, TOUCH_HOLD_MS)
    }
  }
}

/** The lifted cards: copies of the hand's own card elements, fanned, under the pointer. */
function makeGhost(drag: Drag): HTMLElement {
  const ghost = document.createElement('div')
  ghost.className = 'card-ghost'
  ghost.setAttribute('aria-hidden', 'true')
  for (const id of drag.cards.slice(0, 4)) {
    const el = drag.hand?.querySelector(`[data-card-id="${id}"]`)
    if (el) ghost.append(el.cloneNode(true))
  }
  if (drag.cards.length > 1) {
    const count = document.createElement('span')
    count.className = 'card-ghost-count'
    count.textContent = String(drag.cards.length)
    ghost.append(count)
  }
  const why = document.createElement('span')
  why.className = 'card-ghost-why'
  ghost.append(why)
  document.body.append(ghost)
  return ghost
}

/**
 * Moving a card within the hand: a gold bar in the gap where it would land, and the card it
 * would land before. A phone hand can have rows, so the row nearest the pointer counts.
 */
function placeMarker(drag: Drag, hand: HTMLElement) {
  const cards = [...hand.querySelectorAll<HTMLElement>('[data-card-id]:not([data-lifted])')]
  if (cards.length === 0) return
  const rects = cards.map((el) => el.getBoundingClientRect())
  const rowOf = (r: DOMRect) => Math.abs(r.top + r.height / 2 - drag.y)
  const nearest = Math.min(...rects.map(rowOf))
  const row = cards
    .map((el, i) => ({ el, rect: rects[i] }))
    .filter(({ rect }) => rowOf(rect) - nearest < rect.height / 2)
  const next = row.find(({ rect }) => drag.x < rect.left + rect.width / 2)
  const last = row[row.length - 1]
  const after = cards[cards.indexOf(last.el) + 1]
  const beforeEl = next?.el ?? after ?? null
  drag.before = beforeEl ? Number(beforeEl.dataset.cardId) : null
  const anchor = next?.rect ?? last.rect
  const x = next ? anchor.left - 4 : anchor.right + 1
  const marker = document.createElement('span')
  marker.className = 'card-slot-marker'
  marker.style.left = `${x}px`
  marker.style.top = `${anchor.top}px`
  marker.style.height = `${anchor.height}px`
  document.body.append(marker)
  drag.marker = marker
}

/** The pointerup that ends a drag also clicks whatever it ends on; that click isn't a choice. */
function swallowNextClick() {
  const swallow = (e: Event) => {
    e.stopPropagation()
    e.preventDefault()
  }
  window.addEventListener('click', swallow, { capture: true, once: true })
  setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0)
}

function cleanUp(drag: Drag) {
  clearTimeout(drag.timer)
  drag.ghost?.remove()
  drag.marker?.remove()
  for (const el of document.querySelectorAll<HTMLElement>('[data-drop-state]')) {
    delete el.dataset.dropState
  }
  for (const el of document.querySelectorAll<HTMLElement>('[data-lifted]')) {
    delete el.dataset.lifted
  }
}
