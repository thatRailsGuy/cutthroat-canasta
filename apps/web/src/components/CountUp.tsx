import { useEffect, useRef } from 'react'

export interface CountUpProps {
  from: number
  to: number
  /** In ms. */
  duration?: number
  delay?: number
}

/**
 * A number that rolls from `from` up (or down) to `to`, like an adding machine. It renders `to`
 * straight away, so tests and screen readers always get the final number, and with reduced
 * motion it never rolls.
 */
export function CountUp({ from, to, duration = 1200, delay = 0 }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || from === to || typeof requestAnimationFrame !== 'function') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const format = (n: number) => Math.round(n).toLocaleString('en-US')
    let frame = 0
    let start: number | null = null
    const tick = (now: number) => {
      start ??= now + delay
      const t = Math.min(Math.max((now - start) / duration, 0), 1)
      // Ease out: fast at first, settling on the total.
      el.textContent = format(from + (to - from) * (1 - (1 - t) ** 3))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    el.textContent = format(from)
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      el.textContent = format(to)
    }
  }, [from, to, duration, delay])
  return <span ref={ref}>{to.toLocaleString('en-US')}</span>
}
