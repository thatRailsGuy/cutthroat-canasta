import { useEffect, useRef } from 'react'
import { RulesContent } from '../rules/RulesContent'
import type { DrawerRequest } from '../rules/drawer'
import styles from './RulesDrawer.module.css'

export interface RulesDrawerProps {
  /** The latest request to show a section, or null when closed. */
  request: DrawerRequest | null
  onClose: () => void
}

/** The rules page in a slide-over panel, so a player can check a rule without leaving the table. */
export function RulesDrawer({ request, onClose }: RulesDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const section = request?.section ?? null
  const requestId = request?.id ?? null

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (section === null) {
      if (dialog.open) dialog.close()
      return
    }
    if (!dialog.open) dialog.showModal?.()
    dialog.querySelector(`#${section}`)?.scrollIntoView?.({ block: 'start' })
    // `requestId` is a dependency so that asking for the open section again scrolls to it again.
  }, [section, requestId])

  return (
    <dialog ref={dialogRef} className={styles.drawer} onClose={onClose} aria-label="Rules">
      <button type="button" className={styles.close} onClick={onClose}>
        Close
      </button>
      {section !== null && <RulesContent />}
    </dialog>
  )
}
