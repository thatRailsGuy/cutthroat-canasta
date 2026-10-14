import { useEffect, useSyncExternalStore, type RefObject } from 'react'

/** The modal dialogs open now, in the order they opened, so the topmost is last. */
let openModals: HTMLDialogElement[] = []
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

/**
 * Counts a dialog as open while `open` is true. Every dialog opened with `showModal()` calls
 * this, so the toasts and the connection banner can follow it into the top layer (see
 * AboveModals). It goes by `open`, not `dialog.open`, which jsdom never sets.
 */
export function useModal(dialogRef: RefObject<HTMLDialogElement | null>, open: boolean): void {
  useEffect(() => {
    const dialog = dialogRef.current
    if (!open || !dialog) return
    openModals = [...openModals, dialog]
    emit()
    return () => {
      openModals = openModals.filter((d) => d !== dialog)
      emit()
    }
  }, [dialogRef, open])
}

/** The modal dialog on top, or null when none is open. */
export function useTopModal(): HTMLDialogElement | null {
  return useSyncExternalStore(subscribe, topModal, () => null)
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => listeners.delete(onChange)
}

function topModal(): HTMLDialogElement | null {
  return openModals.at(-1) ?? null
}
