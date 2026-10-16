import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { subscribeModals, topModal } from '../modals'

/**
 * Keeps its children seen and usable while a modal dialog is open. A modal sits in the top
 * layer and makes the rest of the page inert, so while one is open the children move into the
 * topmost one, and back here when it closes. They move as one DOM node and React doesn't render
 * them again, so a toast keeps its timer, and a toast that has focus keeps it.
 *
 * A screen reader hears a live region again each time it comes back into the page, so nothing
 * in the children is one. What they have to say goes in `live` (see useLiveRegion), which moves
 * with them and is emptied first.
 *
 * `first` puts them at the start of the dialog, for something in the page's flow such as a
 * banner. Fixed toasts go at the end, after the dialog's own controls in the tab order.
 */
export function AboveModals({
  children,
  live,
  first = false,
}: {
  children: ReactNode
  live: LiveRegion
  first?: boolean
}) {
  const home = useRef<HTMLDivElement>(null)
  const [host] = useState(() => {
    const div = document.createElement('div')
    div.style.display = 'contents'
    return div
  })

  useLayoutEffect(() => {
    const place = () => {
      const parent = topModal() ?? home.current
      if (!parent || host.parentNode === parent) return
      const active = document.activeElement
      const focused = active instanceof HTMLElement && host.contains(active) ? active : null
      live.clear()
      if (first) parent.prepend(live.region, host)
      else parent.append(live.region, host)
      // Taking an element out of the page takes focus from it, even to put it straight back.
      focused?.focus()
    }
    place()
    const unsubscribe = subscribeModals(place)
    return () => {
      unsubscribe()
      // Don't leave them behind in a dialog that is still open.
      live.region.remove()
      host.remove()
    }
  }, [host, live, first])

  return (
    <>
      <div ref={home} style={{ display: 'contents' }} />
      {createPortal(children, host)}
    </>
  )
}

export interface LiveRegion {
  region: HTMLElement
  say: (text: string) => void
  clear: () => void
}

/**
 * A screen-reader-only live region for AboveModals to carry, and `say` to put words in it.
 * React doesn't render it, so AboveModals can empty it before every move.
 */
export function useLiveRegion(role: 'alert' | 'status'): LiveRegion {
  const [live] = useState(() => {
    const region = document.createElement('div')
    region.setAttribute('role', role)
    region.className = 'sr-only'
    const say = (text: string) => {
      // A trailing space that alternates makes the same words count as a change and be said
      // again.
      region.textContent = region.textContent === text ? `${text}\u00a0` : text
    }
    const clear = () => {
      region.textContent = ''
    }
    return { region, say, clear }
  })
  return live
}
