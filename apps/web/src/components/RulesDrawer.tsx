import { useEffect, useRef } from 'react'
import { RulesContent } from '../rules/RulesContent'
import type { PageSection } from '../rules/sections'
import styles from './RulesDrawer.module.css'

export interface RulesDrawerProps {
  /** The section to show, or null when closed. */
  section: PageSection | null
  onClose: () => void
}

/** The rules page in a slide-over panel, so a player can check a rule without leaving the table. */
export function RulesDrawer({ section, onClose }: RulesDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (section === null) {
      if (dialog.open) dialog.close()
      return
    }
    if (!dialog.open) dialog.showModal?.()
    dialog.querySelector(`#${section}`)?.scrollIntoView?.({ block: 'start' })
  }, [section])

  return (
    <dialog ref={dialogRef} className={styles.drawer} onClose={onClose} aria-label="Rules">
      <button type="button" className={styles.close} onClick={onClose}>
        Close
      </button>
      {section !== null && <RulesContent />}
    </dialog>
  )
}
