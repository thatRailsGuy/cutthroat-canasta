import { useEffect, useId, useRef, useState } from 'react'
import { useDisplay, useSystemLessMotion, type DisplayOptions } from '../display'
import styles from './DisplayOptions.module.css'

const OPTIONS: { key: keyof DisplayOptions; name: string; why: string }[] = [
  {
    key: 'large',
    name: 'Larger cards and text',
    why: 'Everything a size up. The table scrolls if it no longer fits.',
  },
  {
    key: 'fourColor',
    name: 'Four-color suits',
    why: 'Diamonds blue, clubs green, so no two suits share a color.',
  },
  {
    key: 'contrast',
    name: 'High contrast',
    why: 'A plain cloth, dark text throughout, and thicker outlines.',
  },
  {
    key: 'calm',
    name: 'Fewer animations',
    why: 'Cards jump into place, and nothing pulses or ripples.',
  },
]

/** The four switches. Each is separate, so any mix works. */
export function DisplaySwitches() {
  const [options, setOptions] = useDisplay()
  const systemCalm = useSystemLessMotion()
  const id = useId()
  return (
    <div className={styles.switches}>
      {OPTIONS.map(({ key, name, why }) => {
        // The device already asks for less motion, so this one is on and can't be turned off.
        const locked = key === 'calm' && systemCalm
        const on = options[key] || locked
        return (
          <div key={key} className={styles.option}>
            <span id={`${id}-${key}`} className={styles.name}>
              {name}
            </span>
            <span id={`${id}-${key}-why`} className={styles.why}>
              {locked ? 'On, because your device asks for less motion.' : why}
            </span>
            <button
              type="button"
              role="switch"
              className={styles.switch}
              aria-checked={on}
              aria-labelledby={`${id}-${key}`}
              aria-describedby={`${id}-${key}-why`}
              // Not `disabled`, so it stays in the tab order and its reason gets read out.
              aria-disabled={locked || undefined}
              onClick={() => {
                if (!locked) setOptions({ ...options, [key]: !options[key] })
              }}
            />
          </div>
        )
      })}
      <p className={styles.kept}>Kept in this browser.</p>
    </div>
  )
}

/**
 * The "Aa" button beside the speaker, and the panel it drops down. Escape, a click elsewhere
 * or tabbing out closes it, the same as the sound panel.
 */
export function DisplayButton() {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      button.current?.focus()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // The panel opens with focus on its first switch.
  useEffect(() => {
    if (open) root.current?.querySelector<HTMLElement>('[role="switch"]')?.focus()
  }, [open])

  return (
    <div
      ref={root}
      className={styles.root}
      onBlur={(e) => {
        const next = e.relatedTarget as Node | null
        if (next && !root.current?.contains(next)) setOpen(false)
      }}
    >
      <button
        ref={button}
        type="button"
        className={styles.button}
        aria-label="Display options"
        aria-expanded={open}
        aria-controls={open ? `${id}-panel` : undefined}
        onClick={() => setOpen(!open)}
      >
        <span aria-hidden="true">
          A<small>a</small>
        </span>
      </button>
      {open && (
        <div id={`${id}-panel`} className={styles.panel} role="dialog" aria-labelledby={`${id}-h`}>
          <h2 id={`${id}-h`}>Display</h2>
          <DisplaySwitches />
        </div>
      )}
    </div>
  )
}
