import { useEffect, useEffectEvent, type FocusEvent, type RefObject } from 'react'
import { topModal } from './modals'

/**
 * Closes a panel dropped down from one of the top buttons on Escape, a click anywhere else, or
 * tabbing out of it. Escape also puts focus back on `button`, which opened the panel. A modal
 * dialog opened from inside the panel, such as the sound chart, takes Escape for itself.
 * Returns the blur handler for `root`.
 */
export function useDropDown(
  root: RefObject<HTMLElement | null>,
  button: RefObject<HTMLElement | null>,
  open: boolean,
  close: () => void,
): (e: FocusEvent) => void {
  const onClose = useEffectEvent(close)
  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const modal = topModal()
      if (modal && root.current?.contains(modal)) return
      onClose()
      button.current?.focus()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, root, button])

  return (e) => {
    const next = e.relatedTarget as Node | null
    if (next && !root.current?.contains(next)) close()
  }
}
