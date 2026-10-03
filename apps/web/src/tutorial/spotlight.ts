import type { CardId } from '@canasta/engine'

/** A part of the table that a lesson step points at. */
export type Area = 'stock' | 'pile' | 'center' | 'hand' | 'you' | 'opponents' | 'side' | 'roundEnd'

const SELECTORS: Record<Area, string> = {
  stock: '[data-stock]',
  pile: '[data-pile]',
  center: 'section[aria-label="Stock and discard pile"]',
  hand: '[data-hand]',
  you: 'section[aria-label="You"]',
  opponents: '[data-coach="opponents"] > *',
  side: '[data-coach="side"]',
  roundEnd: 'section[aria-label$=" scores"]',
}

/** What a step lights up: whole areas, and single cards within them. */
export interface Focus {
  areas: Area[]
  cards: CardId[]
}

/** A rectangle in viewport coordinates. */
export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** The smallest box around every visible element of the area, or null when none shows. */
export function measureArea(area: Area): Box | null {
  return union([...document.querySelectorAll(SELECTORS[area])])
}

export function areaElement(area: Area): Element | null {
  return [...document.querySelectorAll(SELECTORS[area])].find((el) => box(el) !== null) ?? null
}

function box(el: Element): Box | null {
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 ? { x: r.left, y: r.top, w: r.width, h: r.height } : null
}

function union(elements: Element[]): Box | null {
  const boxes = elements.map(box).filter((b) => b !== null)
  if (boxes.length === 0) return null
  const x = Math.min(...boxes.map((b) => b.x))
  const y = Math.min(...boxes.map((b) => b.y))
  const right = Math.max(...boxes.map((b) => b.x + b.w))
  const bottom = Math.max(...boxes.map((b) => b.y + b.h))
  return { x, y, w: right - x, h: bottom - y }
}

export type Side = 'left' | 'right' | 'above' | 'below'

/** Where the lesson card prefers to sit beside each area, best first. */
const SIDES: Record<Area, Side[]> = {
  stock: ['left', 'below', 'right'],
  pile: ['right', 'below', 'left'],
  center: ['below', 'above'],
  hand: ['above', 'below'],
  you: ['above', 'left'],
  opponents: ['below', 'left'],
  side: ['left'],
  roundEnd: ['right', 'left', 'above', 'below'],
}

const GAP = 22
const MARGIN = 16

export interface Placement {
  x: number
  y: number
  /** The card's edge that points at the target, or null when it sits in a corner. */
  side: Side | null
  /** How far along that edge the pointer sits, in px. */
  arrow: number
}

/**
 * Puts a card of the given size beside the target, on the first preferred side with room for
 * it. Without a target the card is centred; with no room on any side it goes in the top
 * right corner, over the side column.
 */
export function place(
  target: Box | null,
  area: Area | undefined,
  card: { w: number; h: number },
  view: { w: number; h: number },
): Placement {
  const clampX = (x: number) => clamp(x, MARGIN, view.w - card.w - MARGIN)
  const clampY = (y: number) => clamp(y, MARGIN, view.h - card.h - MARGIN)
  if (!target || !area) {
    return {
      x: clampX((view.w - card.w) / 2),
      y: clampY((view.h - card.h) / 2),
      side: null,
      arrow: 0,
    }
  }
  const midX = target.x + target.w / 2
  const midY = target.y + target.h / 2
  for (const side of SIDES[area]) {
    let x: number
    let y: number
    if (side === 'left' || side === 'right') {
      x = side === 'left' ? target.x - GAP - card.w : target.x + target.w + GAP
      if (x < MARGIN || x + card.w > view.w - MARGIN) continue
      y = clampY(midY - card.h / 2)
      return { x, y, side, arrow: clamp(midY - y, 28, card.h - 28) }
    }
    y = side === 'above' ? target.y - GAP - card.h : target.y + target.h + GAP
    if (y < MARGIN || y + card.h > view.h - MARGIN) continue
    x = clampX(midX - card.w / 2)
    return { x, y, side, arrow: clamp(midX - x, 28, card.w - 28) }
  }
  return { x: clampX(view.w - card.w - MARGIN), y: MARGIN, side: null, arrow: 0 }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(n, max))
}
