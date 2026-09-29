import type { RuleSection } from '@canasta/engine'

/** Rules-page anchors: every RuleSection, plus pages sections no error links to. */
export type PageSection = RuleSection | 'overview' | 'quick-reference' | 'house-rules'

const RULE_SECTION_TITLES = {
  setup: 'Setup',
  'card-values': 'Card values',
  turn: 'Your turn',
  melds: 'Melds and canastas',
  'initial-meld': 'Initial meld',
  pickup: 'Picking up the pile',
  'going-out': 'Going out',
  scoring: 'Scoring',
  winning: 'Winning',
} as const satisfies Record<RuleSection, string>

/** Table-of-contents order (spec Section 7). */
export const PAGE_SECTIONS: { id: PageSection; title: string }[] = [
  { id: 'quick-reference', title: 'Quick reference' },
  { id: 'overview', title: 'Overview' },
  ...(Object.entries(RULE_SECTION_TITLES) as [RuleSection, string][]).map(([id, title]) => ({
    id,
    title,
  })),
  { id: 'house-rules', title: 'Our house rules vs. standard Canasta' },
]
