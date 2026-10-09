import { useEffect, useId, useRef, useState } from 'react'
import { useChatSound } from '../soundLevel'
import { playTest } from '../soundPlayer'
import { SOUND_CHART, SOUND_LEVELS, type Cue, type SoundLevel } from '../sounds'
import styles from './SoundButton.module.css'

export interface SoundButtonProps {
  level: SoundLevel
  onLevel: (level: SoundLevel) => void
  /** The panel opens where other drop-downs at the top do, so they can close. */
  onOpen?: () => void
}

/** The speaker's sound waves for each step: crossed out, then one, two or three waves. */
const WAVES = [
  <path key="off" d="M15.5 9.5l5 5M20.5 9.5l-5 5" />,
  <path key="1" d="M14.5 10.5a2 2 0 0 1 0 3" />,
  <path key="2" d="M17 8.5a5 5 0 0 1 0 7" />,
  <path key="3" d="M19.5 6.5a8 8 0 0 1 0 11" />,
]

/** What the test button plays at each step: something that step adds. */
const TEST_CUES: Record<SoundLevel, Cue | null> = {
  0: null,
  1: { sound: 'turn', mine: true },
  2: { sound: 'meld', mine: true, cards: 3 },
  3: { sound: 'discard', mine: false },
}

/**
 * The speaker button beside Rules, and the panel it opens: a slider from Off to Whole table,
 * the chat clink's switch (the same one as the bell on Table talk), a test sound, and a chart
 * of what each step plays.
 */
export function SoundButton({ level, onLevel, onOpen }: SoundButtonProps) {
  const [open, setOpen] = useState(false)
  const [chartOpen, setChartOpen] = useState(false)
  const [chatOn, setChatOn] = useChatSound()
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const chart = useRef<HTMLDialogElement>(null)
  const id = useId()
  const name = SOUND_LEVELS[level].name

  // Escape or a click anywhere else closes the panel. The chart closes first, on its own.
  // Escape puts focus back on the speaker button, which opened the panel.
  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || chart.current?.open) return
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

  useEffect(() => {
    const dialog = chart.current
    if (!dialog) return
    if (chartOpen && !dialog.open) dialog.showModal?.()
    if (!chartOpen && dialog.open) dialog.close()
  }, [chartOpen])

  const test = TEST_CUES[level]

  return (
    <div
      ref={root}
      className={styles.root}
      onBlur={(e) => {
        // Tabbing out of the panel closes it, as a click elsewhere does.
        const next = e.relatedTarget as Node | null
        if (next && !root.current?.contains(next)) setOpen(false)
      }}
    >
      <button
        ref={button}
        type="button"
        className={styles.button}
        aria-label={`Sound: ${name}`}
        aria-expanded={open}
        aria-controls={open ? `${id}-panel` : undefined}
        onClick={() => {
          if (!open) onOpen?.()
          setOpen(!open)
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" data-level={level}>
          <path d="M3 9h3l5-4v14l-5-4H3z" />
          {level === 0 ? WAVES[0] : WAVES.slice(1, level + 1)}
        </svg>
      </button>
      {open && (
        <div id={`${id}-panel`} className={styles.panel} role="dialog" aria-label="Sound">
          <h2>Sound</h2>
          <div className={styles.levels}>
            <label htmlFor={`${id}-level`} className={styles.label}>
              What you hear
            </label>
            <input
              id={`${id}-level`}
              // The panel opens to the slider, so arrow keys change the step at once.
              autoFocus
              type="range"
              min={0}
              max={3}
              step={1}
              value={level}
              aria-valuetext={name}
              aria-describedby={`${id}-hint`}
              onChange={(e) => onLevel(Number(e.target.value) as SoundLevel)}
            />
            <div className={styles.stops} aria-hidden="true">
              {SOUND_LEVELS.map((step, i) => (
                <span key={step.name} className={i === level ? styles.on : undefined}>
                  {step.name}
                </span>
              ))}
            </div>
          </div>
          <p id={`${id}-hint`} className={styles.hint}>
            {SOUND_LEVELS[level].hint}
          </p>
          {/* Off silences it too, so it's greyed out but keeps its tick for later. */}
          <label className={styles.chat}>
            <input
              type="checkbox"
              checked={chatOn}
              disabled={level === 0}
              onChange={(e) => setChatOn(e.target.checked)}
            />
            Clink for new chat lines
          </label>
          <div className={styles.row}>
            <button type="button" disabled={!test} onClick={() => test && playTest(test)}>
              Play a test sound
            </button>
            <button
              type="button"
              className={styles.link}
              aria-haspopup="dialog"
              onClick={() => setChartOpen(true)}
            >
              What each step plays
            </button>
          </div>
        </div>
      )}
      <dialog
        ref={chart}
        className={styles.chart}
        aria-labelledby={`${id}-chart`}
        onClose={() => setChartOpen(false)}
        onClick={(e) => {
          // A click on the dialog itself, not its contents, landed on the backdrop.
          if (e.target === e.currentTarget) setChartOpen(false)
        }}
      >
        <div className={styles.chartHead}>
          <h2 id={`${id}-chart`}>What each step plays</h2>
          <button type="button" onClick={() => setChartOpen(false)}>
            Close
          </button>
        </div>
        <p className={styles.chartNote}>
          A dot means the sound plays. Your step is shaded. Everything also shows on screen.
        </p>
        <table>
          <thead>
            <tr>
              <th scope="col">Sound</th>
              {SOUND_LEVELS.map((step, i) => (
                <th
                  key={step.name}
                  scope="col"
                  className={i === level ? styles.shaded : undefined}
                  aria-current={i === level ? 'true' : undefined}
                >
                  {step.name}
                </th>
              ))}
            </tr>
          </thead>
          {SOUND_CHART.map((group) => (
            <tbody key={group.group}>
              <tr className={styles.group}>
                <th scope="colgroup" colSpan={5}>
                  {group.group}
                </th>
              </tr>
              {group.rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {SOUND_LEVELS.map((step, i) => (
                    <td
                      key={step.name}
                      className={`${i >= row.step ? styles.yes : styles.no} ${i === level ? styles.shaded : ''}`}
                      aria-label={i >= row.step ? 'Plays' : 'Silent'}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </dialog>
    </div>
  )
}
