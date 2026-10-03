import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import { usePhone } from '../layout'
import { STEPS } from './lesson'
import {
  areaElement,
  measureArea,
  place,
  type Area,
  type Box,
  type Focus,
  type Side,
} from './spotlight'
import styles from './Coach.module.css'

export interface CoachProps {
  step: number
  /** Why your last move was refused. */
  hint: string | null
  /** Counts refused moves, so the card shakes again for the same hint. */
  refusals: number
  /** What this step lights up on the table. */
  focus: Focus
  /** Dot's moves so far this turn, while she plays. */
  moves: string[]
  onNext: () => void
  onRestart: () => void
}

/**
 * The lesson card: what to do now, and why. It dims the table except for what the step is
 * about, and on a wide screen it sits beside that, pointing at it. On a phone it is a strip
 * above your hand.
 */
export function Coach({ step, hint, refusals, focus, moves, onNext, onRestart }: CoachProps) {
  const current = STEPS[step]
  const last = step === STEPS.length - 1
  const readOnly = !current.allow && !current.waiting
  const phone = usePhone()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLElement>(null)
  const tracked = useTracked(focus, ref)

  useEffect(() => {
    if (canAnimate()) {
      ref.current?.animate(
        [
          { translate: '0 -18px', rotate: '-3deg', opacity: 0 },
          { translate: '0 0', rotate: '0deg', opacity: 1 },
        ],
        { duration: 320, easing: 'cubic-bezier(.2,.9,.3,1.3)' },
      )
    }
    // A step about nothing on the table brings the card itself into view, as on a phone.
    const target = focus.areas[0] ? areaElement(focus.areas[0]) : ref.current
    target?.scrollIntoView?.({ block: 'nearest', behavior: canAnimate() ? 'smooth' : 'auto' })
    // Only a new step moves the card; the focus follows from it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  useEffect(() => {
    if (refusals === 0 || !canAnimate()) return
    ref.current?.animate(
      { translate: ['0 0', '-9px 0', '8px 0', '-6px 0', '4px 0', '0 0'] },
      { duration: 420, easing: 'ease-in-out' },
    )
  }, [refusals])

  const primary = tracked.areas.find((a) => a.box !== null)
  const placement =
    phone || !tracked.self
      ? null
      : place(primary?.box ?? null, primary?.area, tracked.self, tracked.view)
  const style: CSSProperties | undefined = placement
    ? ({
        left: placement.x,
        top: placement.y,
        '--arrow': `${placement.arrow}px`,
      } as CSSProperties)
    : undefined

  const card = (
    <section
      ref={ref}
      className={`${styles.coach} ${phone ? styles.strip : styles.floating}`}
      style={style}
      data-side={placement?.side ?? undefined}
      data-placed={phone || placement ? '' : undefined}
      aria-label="Lesson"
    >
      {!phone && <span className={styles.pin} aria-hidden="true" />}
      <div className={styles.head}>
        <ol className={styles.pips} aria-hidden="true">
          {STEPS.map((_, i) => (
            <li key={i} className={i < step ? styles.done : i === step ? styles.now : undefined} />
          ))}
        </ol>
        <p className={styles.count}>
          Step {step + 1} of {STEPS.length}
        </p>
      </div>
      <h2 className={styles.title}>{current.title}</h2>
      {current.waiting ? (
        <p className={styles.waiting}>
          <span className={styles.dots} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          Dot is playing…
        </p>
      ) : (
        current.task && (
          <p className={styles.task}>
            {placement?.side && <Pointer side={placement.side} />}
            {current.task}
          </p>
        )
      )}
      {current.waiting && moves.length > 0 && (
        <ul className={styles.moves}>
          {moves.map((move, i) => (
            <li key={i}>{move}</li>
          ))}
        </ul>
      )}
      {(!phone || open || !current.task) && <p className={styles.body}>{current.body}</p>}
      <p className={styles.hint} role="status">
        {hint}
      </p>
      <div className={styles.buttons}>
        {last ? (
          <>
            <Link className={styles.primary} to="/">
              Play a real game
            </Link>
            <Link to="/rules">Read the rules</Link>
            <button type="button" onClick={onRestart}>
              Play it again
            </button>
          </>
        ) : (
          <>
            {readOnly && (
              <button type="button" className={styles.primary} onClick={onNext}>
                Next
              </button>
            )}
            {phone && current.task && (
              <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
                {open ? 'Less' : 'Why?'}
              </button>
            )}
            {step > 0 && (!phone || open) && (
              <button type="button" className={styles.quiet} onClick={onRestart}>
                Start over
              </button>
            )}
          </>
        )}
      </div>
    </section>
  )

  // The strip stays out of the dimming: it is a hole in it, like the table's lit areas.
  const holes = [
    ...tracked.areas.flatMap((a) => (a.box ? [pad(a.box, 8)] : [])),
    ...(phone && tracked.self ? [pad(tracked.self, 4)] : []),
  ]
  const overlay = (
    <div className={styles.overlay} aria-hidden="true">
      <svg className={styles.dim} width="100%" height="100%">
        <defs>
          <mask id="coach-spotlight">
            <rect width="100%" height="100%" fill="white" />
            {holes.map((b, i) => (
              <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx="14" fill="black" />
            ))}
          </mask>
        </defs>
        <rect width="100%" height="100%" mask="url(#coach-spotlight)" />
      </svg>
      {tracked.areas.map(
        (a, i) => a.box && <span key={i} className={styles.ring} style={boxStyle(pad(a.box, 8))} />,
      )}
    </div>
  )

  return (
    <>
      {phone ? card : createPortal(card, document.body)}
      {createPortal(overlay, document.body)}
    </>
  )
}

/** An arrow from the task toward the table, on the side the card points from. */
function Pointer({ side }: { side: Side }) {
  const turn = { left: 0, below: -90, right: 180, above: 90 }[side]
  return (
    <svg
      className={styles.pointer}
      viewBox="0 0 24 24"
      style={{ rotate: `${turn}deg` }}
      aria-hidden="true"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

interface Tracked {
  areas: { area: Area; box: Box | null }[]
  /** The lesson card itself. */
  self: Box | null
  view: { w: number; h: number }
}

const NOTHING: Tracked = { areas: [], self: null, view: { w: 0, h: 0 } }

/**
 * Where the lit areas and the lesson card are on screen, measured every frame, so the
 * spotlight follows scrolling, resizing and the table changing under it.
 */
function useTracked(focus: Focus, self: RefObject<HTMLElement | null>): Tracked {
  const [tracked, setTracked] = useState(NOTHING)
  const focusRef = useRef(focus)
  useLayoutEffect(() => {
    focusRef.current = focus
  })
  useEffect(() => {
    let frame = 0
    let last = ''
    const measure = () => {
      const { areas } = focusRef.current
      const rect = self.current?.getBoundingClientRect()
      const next: Tracked = {
        areas: areas.map((area) => ({ area, box: measureArea(area) })),
        self:
          rect && rect.width > 0
            ? { x: rect.left, y: rect.top, w: rect.width, h: rect.height }
            : null,
        view: { w: window.innerWidth, h: window.innerHeight },
      }
      const key = JSON.stringify(next)
      if (key !== last) {
        last = key
        setTracked(next)
      }
      if (typeof requestAnimationFrame === 'function') frame = requestAnimationFrame(measure)
    }
    measure()
    return () => {
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame)
    }
  }, [self])
  return tracked
}

function pad(b: Box, by: number): Box {
  return { x: b.x - by, y: b.y - by, w: b.w + by * 2, h: b.h + by * 2 }
}

function boxStyle(b: Box): CSSProperties {
  return { left: b.x, top: b.y, width: b.w, height: b.h }
}

function canAnimate(): boolean {
  if (typeof Element === 'undefined' || typeof Element.prototype.animate !== 'function') {
    return false
  }
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}
