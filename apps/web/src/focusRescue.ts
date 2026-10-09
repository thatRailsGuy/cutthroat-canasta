import { useEffect } from 'react'

/**
 * Where focus goes when the element that had it leaves the page: back into the same group, at
 * the same place, then the first of these groups that is on the page. Groups are marked with
 * `data-focus-group`.
 */
const FALLBACK_GROUPS = ['next', 'hand', 'staging', 'pile']

const FOCUSABLE = 'button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]'

interface Focused {
  element: HTMLElement
  group: string | null
  /** Its place among the group's focusable elements. */
  index: number
}

function focusables(root: Element): HTMLElement[] {
  const own = root.matches(FOCUSABLE) ? [root as HTMLElement] : []
  return [...own, ...root.querySelectorAll<HTMLElement>(FOCUSABLE)]
}

function groupOf(element: Element): Element | null {
  return element.closest('[data-focus-group]')
}

/** The element to focus in place of `lost`, or null if there's nowhere sensible. */
export function rescueTarget(lost: Focused, doc: Document = document): HTMLElement | null {
  if (lost.group) {
    const group = doc.querySelector(`[data-focus-group="${lost.group}"]`)
    const inGroup = group ? focusables(group) : []
    if (inGroup.length > 0) return inGroup[Math.min(Math.max(lost.index, 0), inGroup.length - 1)]
  }
  for (const name of FALLBACK_GROUPS) {
    const group = doc.querySelector(`[data-focus-group="${name}"]`)
    const first = group ? focusables(group)[0] : undefined
    if (first) return first
  }
  return null
}

/**
 * Keeps keyboard focus on the table. A card you stage or discard, a button that goes when you
 * use it, and the whole table at each new deal all leave the page; without this, focus would
 * drop back to the start of the page and a keyboard player would have to tab all the way back.
 */
export function useFocusRescue(): void {
  useEffect(() => {
    let last: Focused | null = null
    const onFocusIn = (event: FocusEvent) => {
      const element = event.target as HTMLElement
      const group = groupOf(element)
      last = {
        element,
        group: group?.getAttribute('data-focus-group') ?? null,
        index: group ? focusables(group).indexOf(element) : -1,
      }
    }
    const rescue = () => {
      if (!last || last.element.isConnected) return
      const active = document.activeElement
      if (active && active !== document.body) return
      const target = rescueTarget(last)
      last = null
      target?.focus()
    }
    const observer = new MutationObserver(rescue)
    observer.observe(document.body, { childList: true, subtree: true })
    document.addEventListener('focusin', onFocusIn)
    return () => {
      observer.disconnect()
      document.removeEventListener('focusin', onFocusIn)
    }
  }, [])
}
