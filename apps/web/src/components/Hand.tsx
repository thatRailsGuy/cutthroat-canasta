import type { Card as CardValue, CardId } from '@canasta/engine'
import { useEffect, useRef, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { arrangeHand } from '../handOrder'
import { Card } from './Card'
import styles from './Table.module.css'

/** On a phone, a row holds at most this many cards; more start another row. */
export const ROW_LIMIT = 10

/** Spread: the cards wrap, or split into rows on a phone. One line: one overlapping row. */
export type HandLayout = 'spread' | 'line'

export interface HandProps {
  cards: CardValue[]
  selected: readonly CardId[]
  /** Staged cards stay in the staging area, so the hand hides them. */
  hidden: ReadonlySet<CardId>
  /** The card just drawn from the stock, marked so it stands out in the sorted hand. */
  fresh?: CardId | null
  /** Cards the tutorial points at. */
  lit?: readonly CardId[]
  /**
   * A phone: the hand is split into even rows of overlapping cards, each as wide as the
   * screen, instead of wrapping.
   */
  rows?: boolean
  /** Your own order of the cards; null keeps the hand sorted. */
  order?: readonly CardId[] | null
  layout?: HandLayout
  /** Shows the Spread / One line switch. */
  onLayout?: (layout: HandLayout) => void
  /** Goes back to the sorted order; offered once the order is your own. */
  onSort?: () => void
  /** Moves a card to sit before another one (null: at the end), from the keyboard. */
  onMove?: (cardId: CardId, before: CardId | null) => void
  /** Starts dragging a card. */
  onDragStart?: (event: PointerEvent<HTMLButtonElement>, cardId: CardId) => void
  onToggle: (cardId: CardId) => void
}

export function Hand({
  cards,
  selected,
  hidden,
  fresh = null,
  lit = [],
  rows = false,
  order = null,
  layout = 'spread',
  onLayout,
  onSort,
  onMove,
  onDragStart,
  onToggle,
}: HandProps) {
  const shown = arrangeHand(cards, order).filter((c) => !hidden.has(c.id))
  // A card moved from the keyboard keeps the focus in its new place.
  const sectionRef = useRef<HTMLElement>(null)
  const refocus = useRef<CardId | null>(null)
  useEffect(() => {
    if (refocus.current === null) return
    sectionRef.current?.querySelector<HTMLElement>(`[data-card-id="${refocus.current}"]`)?.focus()
    refocus.current = null
  })
  const move = (cardId: CardId, step: -1 | 1) => {
    const i = shown.findIndex((c) => c.id === cardId)
    const j = i + step
    if (!onMove || j < 0 || j >= shown.length) return
    refocus.current = cardId
    onMove(cardId, step === -1 ? shown[j].id : (shown[j + 1]?.id ?? null))
  }
  const toCard = (c: CardValue) => (
    <Card
      key={c.id}
      card={c}
      selected={selected.includes(c.id)}
      fresh={c.id === fresh}
      lit={lit.includes(c.id)}
      onClick={() => onToggle(c.id)}
      onPointerDown={onDragStart && ((e) => onDragStart(e, c.id))}
      keyShortcuts={onMove ? 'Alt+ArrowLeft Alt+ArrowRight' : undefined}
      onKeyDown={(e) => {
        if (!e.altKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return
        e.preventDefault()
        move(c.id, e.key === 'ArrowLeft' ? -1 : 1)
      }}
    />
  )
  const line = layout === 'line'
  const section = (cardsBody: ReactNode, className: string, style?: CSSProperties) => (
    <section
      ref={sectionRef}
      className={className}
      style={style}
      aria-label="Your hand"
      data-hand=""
      data-focus-group="hand"
      data-drop={onDragStart ? 'hand' : undefined}
    >
      {cardsBody}
    </section>
  )
  let body
  if (line) {
    body = section(shown.map(toCard), `${styles.hand} ${styles.handLine}`, {
      '--count': Math.max(shown.length, 2),
    } as CSSProperties)
  } else if (!rows) {
    body = section(shown.map(toCard), styles.hand)
  } else {
    const perRow = Math.ceil(shown.length / Math.max(1, Math.ceil(shown.length / ROW_LIMIT)))
    const split = handRows(shown, perRow)
    body = section(
      split.map((row, i) => (
        <div key={i} className={styles.handRow}>
          {row.map(toCard)}
        </div>
      )),
      `${styles.hand} ${styles.handRows}`,
      { '--per-row': Math.max(perRow, 2) } as CSSProperties,
    )
  }
  if (!onLayout && !onSort) return body
  return (
    <div className={styles.handArea}>
      <div className={styles.handBar}>
        <span className={styles.handLabel}>Your hand</span>
        {order && onSort && (
          <>
            <span className={styles.orderNote}>your order</span>
            <button type="button" className={styles.handTool} onClick={onSort}>
              Sort
            </button>
          </>
        )}
        {onLayout && (
          <span className={styles.layoutSwitch} role="group" aria-label="Hand layout">
            <button type="button" aria-pressed={!line} onClick={() => onLayout('spread')}>
              Spread
            </button>
            <button type="button" aria-pressed={line} onClick={() => onLayout('line')}>
              One line
            </button>
          </span>
        )}
      </div>
      {body}
    </div>
  )
}

function handRows<T>(cards: T[], perRow: number): T[][] {
  const rows: T[][] = []
  const step = Math.max(perRow, 1)
  for (let i = 0; i < cards.length; i += step) rows.push(cards.slice(i, i + step))
  return rows
}
