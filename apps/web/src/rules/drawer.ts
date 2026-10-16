import { createContext, useCallback, useContext, useState } from 'react'
import type { PageSection } from './sections'

/**
 * A request to show the drawer at a section. `id` changes on every request, so asking for the
 * section that is already open scrolls to it again.
 */
export interface DrawerRequest {
  section: PageSection
  id: number
}

/** Inside a game, "Why?" links open the rules drawer instead of leaving the table. */
export const RulesDrawerContext = createContext<((section: PageSection) => void) | null>(null)

export const useOpenRules = () => useContext(RulesDrawerContext)

/** The drawer's latest request, with `open` to show a section and `close` to put it away. */
export function useRulesDrawer() {
  const [request, setRequest] = useState<DrawerRequest | null>(null)
  const open = useCallback(
    (section: PageSection) => setRequest((r) => ({ section, id: (r?.id ?? 0) + 1 })),
    [],
  )
  const close = useCallback(() => setRequest(null), [])
  return { request, open, close }
}
