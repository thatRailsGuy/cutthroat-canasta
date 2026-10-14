import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTopModal } from '../modals'

/**
 * Keeps its children seen and usable while a modal dialog is open. A modal sits in the top
 * layer and makes the rest of the page inert, so while one is open the children move into the
 * topmost one, and back here when it closes. They move as one DOM node and React doesn't render
 * them again, so a toast keeps its timer and a screen reader isn't told about it a second time.
 *
 * `first` puts them at the start of the dialog, for something in the page's flow such as a
 * banner. Fixed toasts go at the end, after the dialog's own controls in the tab order.
 */
export function AboveModals({ children, first = false }: { children: ReactNode; first?: boolean }) {
  const home = useRef<HTMLDivElement>(null)
  const [host] = useState(() => {
    const div = document.createElement('div')
    div.style.display = 'contents'
    return div
  })
  const modal = useTopModal()

  useLayoutEffect(() => {
    const parent = modal ?? home.current
    if (!parent) return
    if (first) parent.prepend(host)
    else parent.append(host)
  }, [modal, host, first])
  // Don't leave the empty host behind in a dialog that is still open.
  useLayoutEffect(() => () => host.remove(), [host])

  return (
    <>
      <div ref={home} style={{ display: 'contents' }} />
      {createPortal(children, host)}
    </>
  )
}
