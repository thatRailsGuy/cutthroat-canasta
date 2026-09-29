import type { RuleSection } from '@canasta/engine'
import { Link } from 'react-router'
import { useOpenRules } from '../rules/drawer'

/** "Why?" for a rule error. In a game it opens the rules drawer; elsewhere it links to /rules. */
export function WhyLink({ section }: { section: RuleSection }) {
  const openRules = useOpenRules()
  if (!openRules) return <Link to={`/rules#${section}`}>Why?</Link>
  return (
    <a
      href={`/rules#${section}`}
      onClick={(event) => {
        // A modified or non-primary click keeps its usual meaning, such as a new tab.
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return
        }
        event.preventDefault()
        openRules(section)
      }}
    >
      Why?
    </a>
  )
}
