import { useEffect, useId, useRef, useState } from 'react'
import { useDisplay, useSystemLessMotion, type DisplayOptions } from '../display'
import { useDropDown } from '../dropDown'
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
  const onBlur = useDropDown(root, button, open, () => setOpen(false))

  return (
    <div ref={root} className={styles.root} onBlur={onBlur}>
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
      {open && <DisplayPanel id={`${id}-panel`} />}
    </div>
  )
}

/**
 * The display panel, dropped down under the top buttons from Aa or, on a phone, from the
 * table's Menu. It opens with focus on its first switch.
 */
export function DisplayPanel({ id: panelId }: { id: string }) {
  const panel = useRef<HTMLDivElement>(null)
  const id = useId()

  useEffect(() => {
    panel.current?.querySelector<HTMLElement>('[role="switch"]')?.focus()
  }, [])

  return (
    <div
      ref={panel}
      id={panelId}
      className={styles.panel}
      role="dialog"
      aria-labelledby={`${id}-h`}
    >
      <h2 id={`${id}-h`}>Display</h2>
      <DisplaySwitches />
    </div>
  )
}
