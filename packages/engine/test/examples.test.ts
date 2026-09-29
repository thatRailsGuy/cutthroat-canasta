import { describe, expect, it } from 'vitest'
import {
  RULES_EXAMPLES,
  buildMeld,
  buildPickup,
  buildScoringPlayers,
  type MeldExample,
  type PickupExample,
  type ScoringExample,
} from '../src/examples'
import { RULE_ERROR_SECTIONS } from '../src/errors'
import { checkMeldCards, isCanasta, isNaturalCanasta } from '../src/meldRules'
import { validatePlay } from '../src/play'
import { scoreRound } from '../src/scoring'

const byKind = <K extends RulesKind>(kind: K) =>
  RULES_EXAMPLES.filter(
    (e): e is Extract<(typeof RULES_EXAMPLES)[number], { kind: K }> => e.kind === kind,
  )
type RulesKind = (typeof RULES_EXAMPLES)[number]['kind']

describe('rules page examples', () => {
  it('have unique ids', () => {
    const ids = RULES_EXAMPLES.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('put each expected error under the section it links to', () => {
    for (const example of RULES_EXAMPLES) {
      if (example.kind === 'scoring' || example.expected === null) continue
      expect(RULE_ERROR_SECTIONS[example.expected], example.id).toBe(example.section)
    }
  })

  it.each(byKind('meld').map((e) => [e.id, e] as const))('meld %s', (_, example: MeldExample) => {
    const { after } = buildMeld(example)
    expect(checkMeldCards(after)?.code ?? null).toBe(example.expected)
    if (example.canasta !== undefined) {
      const meld = { id: 'm', rank: 'K' as const, cards: after }
      const kind = !isCanasta(meld) ? null : isNaturalCanasta(meld) ? 'natural' : 'mixed'
      expect(kind).toBe(example.canasta)
    }
  })

  it.each(byKind('pickup').map((e) => [e.id, e] as const))(
    'pickup %s',
    (_, example: PickupExample) => {
      // The full check the server and the table preview run, including the initial meld minimum.
      const { player, pile, pileSize, batch } = buildPickup(example)
      const result = validatePlay({ player, pile, pileSize, takesPile: true }, batch)
      expect(result.ok ? null : result.error.code).toBe(example.expected)
    },
  )

  it.each(byKind('scoring').map((e) => [e.id, e] as const))(
    'scoring %s',
    (_, example: ScoringExample) => {
      expect(scoreRound(buildScoringPlayers(example), example.wentOut)).toEqual(example.expected)
    },
  )
})
