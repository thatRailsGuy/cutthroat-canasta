import { useLayoutEffect, useSyncExternalStore, type RefObject } from 'react'

/** The modal dialogs open now, in the order they opened, so the topmost is last. */
let openModals: HTMLDialogElement[] = []
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

/**
 * Opens the dialog with `showModal()` while `open` is true, and closes it when `open` goes
 * false or the dialog unmounts. Every modal dialog opens through this, so the toasts and the
 * connection banner can follow the top one into the top layer (see AboveModals). It goes by
 * `open`, not `dialog.open`, which jsdom never sets.
 *
 * It is a layout effect so that a dialog that unmounts while open gives back the toasts before
 * React takes it out of the page.
 */
export function useModalDialog(dialogRef: RefObject<HTMLDialogElement | null>, open: boolean) {
  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!open || !dialog) return
    const opener = document.activeElement
    if (!dialog.open) dialog.showModal?.()
    openModals = [...openModals, dialog]
    emit()
    return () => {
      if (dialog.open) dialog.close()
      openModals = openModals.filter((d) => d !== dialog)
      emit()
      // Closing puts focus back where it was before the dialog opened, unless that was a toast's
      // Why? link, which was inside this dialog as it closed and only moves out now. Focus would
      // fall to the page itself, so it goes back to the link here, once React is done: React
      // puts focus back on whatever had it before it changed the page.
      queueMicrotask(() => {
        const active = document.activeElement
        const lost = !active || active === document.body || dialog.contains(active)
        if (lost && opener instanceof HTMLElement && opener.isConnected) opener.focus()
      })
    }
  }, [dialogRef, open])
}

/** The modal dialog on top, or null when none is open. */
export function topModal(): HTMLDialogElement | null {
  return openModals.at(-1) ?? null
}

/**
 * Calls `onChange` as soon as a dialog opens or closes, while React is still working: a dialog
 * that unmounts has to give back what is in it before it leaves the page.
 */
export function subscribeModals(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => listeners.delete(onChange)
}

/** The modal dialog on top, or null when none is open, for rendering. */
export function useTopModal(): HTMLDialogElement | null {
  return useSyncExternalStore(subscribeModals, topModal, () => null)
}
