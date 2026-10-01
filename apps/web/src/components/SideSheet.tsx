import { useEffect, useRef, type ReactNode } from 'react'
import styles from './SideSheet.module.css'

export interface SideSheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
}

/**
 * On a phone the side column has no room beside the table, so the score pad and table talk
 * slide up from the bottom in this sheet. Tapping the dimmed table behind it closes it.
 */
export function SideSheet({ open, onClose, children }: SideSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal?.()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className={styles.sheet}
      onClose={onClose}
      onClick={(e) => {
        // A click on the dialog itself, not its contents, landed on the backdrop.
        if (e.target === e.currentTarget) onClose()
      }}
      aria-label="Score pad and table talk"
    >
      <div className={styles.body}>
        <button type="button" className={styles.close} onClick={onClose}>
          Close
        </button>
        {children}
      </div>
    </dialog>
  )
}
