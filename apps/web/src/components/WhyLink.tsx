import type { RuleSection } from '@canasta/engine'
import { Link } from 'react-router'

/** "Why?" for a rule error: a link to that rule's section of the rules page. */
export function WhyLink({ section }: { section: RuleSection }) {
  return <Link to={`/rules#${section}`}>Why?</Link>
}
