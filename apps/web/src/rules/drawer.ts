import { createContext, useContext } from 'react'
import type { PageSection } from './sections'

/** Inside a game, "Why?" links open the rules drawer instead of leaving the table. */
export const RulesDrawerContext = createContext<((section: PageSection) => void) | null>(null)

export const useOpenRules = () => useContext(RulesDrawerContext)
