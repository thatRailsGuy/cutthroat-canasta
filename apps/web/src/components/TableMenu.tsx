import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import { useDropDown } from '../dropDown'
import { SOUND_LEVELS, type SoundLevel } from '../sounds'
import { DisplayPanel } from './DisplayOptions'
import { SoundPanel } from './SoundButton'
import styles from './TableMenu.module.css'

export interface TableMenuProps {
  /** The Menu button, so focus can go back to it, as after Quit's "Keep playing". */
  buttonRef: RefObject<HTMLButtonElement | null>
  /** The Menu button's look: the same as the game's other buttons. */
  className: string
  /** The host tools row's label, or null for a player who can't open them. */
  host: string | null
  onHost: () => void
  /** Quit game, or undefined for a player who isn't playing this game. */
  onQuit?: () => void
  level: SoundLevel
  onLevel: (level: SoundLevel) => void
  /** The menu opens where other drop-downs at the top do, so they can close. */
  onOpen?: () => void
}

/** What the menu shows: its list, or the panel one of its rows opened in its place. */
type View = 'list' | 'sound' | 'display'

/**
 * On a phone, one Menu button holds Host, Quit game, the speaker and Aa, which don't fit beside
 * Scores and Rules. Sound and Display open their panels where the list was. Host tools and Quit
 * game close the menu and do what their own buttons do on a wider screen.
 */
export function TableMenu({
  buttonRef,
  className,
  host,
  onHost,
  onQuit,
  level,
  onLevel,
  onOpen,
}: TableMenuProps) {
  const [view, setView] = useState<View | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const id = useId()
  const onBlur = useDropDown(root, buttonRef, view !== null, () => setView(null))

  // The list opens with focus on its first row.
  useEffect(() => {
    if (view === 'list') list.current?.querySelector('button')?.focus()
  }, [view])

  /**
   * Closes the menu and runs `then`, which opens a dialog or the quit confirm. Focus moves to
   * Menu first, as the row pressed goes away, so a dialog gives focus back to Menu as it closes.
   */
  const leave = (then: () => void) => {
    setView(null)
    buttonRef.current?.focus()
    then()
  }

  return (
    <div ref={root} className={styles.root} onBlur={onBlur}>
      <button
        ref={buttonRef}
        type="button"
        className={className}
        aria-expanded={view !== null}
        aria-controls={view ? `${id}-panel` : undefined}
        onClick={() => {
          if (!view) onOpen?.()
          setView(view ? null : 'list')
        }}
      >
        Menu
      </button>
      {view === 'list' && (
        <div ref={list} id={`${id}-panel`} className={styles.panel} role="dialog" aria-label="Menu">
          {host && (
            <button type="button" className={styles.item} onClick={() => leave(onHost)}>
              {host}
            </button>
          )}
          <button
            type="button"
            className={styles.item}
            aria-label={`Sound: ${SOUND_LEVELS[level].name}`}
            onClick={() => setView('sound')}
          >
            Sound
            <span className={styles.note} aria-hidden="true">
              {SOUND_LEVELS[level].name}
            </span>
          </button>
          <button
            type="button"
            className={styles.item}
            aria-label="Display options"
            onClick={() => setView('display')}
          >
            Display
            <span className={styles.note} aria-hidden="true">
              A<small>a</small>
            </span>
          </button>
          {onQuit && (
            <>
              <hr className={styles.rule} />
              <button
                type="button"
                className={`${styles.item} ${styles.quit}`}
                onClick={() => leave(onQuit)}
              >
                Quit game
              </button>
            </>
          )}
        </div>
      )}
      {view === 'sound' && <SoundPanel id={`${id}-panel`} level={level} onLevel={onLevel} />}
      {view === 'display' && <DisplayPanel id={`${id}-panel`} />}
    </div>
  )
}
