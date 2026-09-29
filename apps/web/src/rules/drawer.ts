import { createContext, useContext } from 'react'
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
