import { describe, expect, it } from 'vitest'
import { legalityPreview } from '../src/preview'
import { applyAction } from '../src/actions'
import { viewFor } from '../src/view'
import type { Action } from '../src/types'
import { cards, ids, makeGame, makePlayer, meld } from './fixtures'

describe('legalityPreview', () => {
  const nines = cards('9h 9s')
  const wilds = cards('JK JK 2c')
  const game = makeGame({
    players: [
      makePlayer({
        id: 'a',
        hand: [...nines, ...wilds, ...cards('4c 5c')],
        melds: [meld('Qh Qd Qs')],
      }),
      makePlayer({ id: 'b', hand: cards('Kh Kd') }),
    ],
  })

  it('agrees with the engine about an illegal meld', () => {
    const action: Action = {
      type: 'meld',
      play: { newMelds: [[...ids(nines), ...ids(wilds)]], additions: [] },
    }
    const engine = applyAction(game, 'a', action)
    expect(engine.ok).toBe(false)
    expect(legalityPreview(viewFor(game, 'a'), action)?.code).toBe(
      engine.ok ? null : engine.error.code,
    )
  })

  it('returns null for a legal action', () => {
    const action: Action = {
      type: 'meld',
      play: { newMelds: [[...ids(nines), wilds[0].id]], additions: [] },
    }
    expect(legalityPreview(viewFor(game, 'a'), action)).toBeNull()
  })

  it("flags an action when it isn't your turn", () => {
    expect(legalityPreview(viewFor(game, 'b'), { type: 'drawStock' })?.code).toBe('NOT_YOUR_TURN')
  })

  it('checks the phase and discards', () => {
    const view = viewFor(game, 'a')
    expect(legalityPreview(view, { type: 'drawStock' })?.code).toBe('WRONG_PHASE')
    expect(legalityPreview(view, { type: 'discard', cardId: 123_456 })?.code).toBe(
      'CARD_NOT_IN_HAND',
    )
  })

  it('throws on an unknown action type', () => {
    const view = viewFor(game, 'a')
    expect(() => legalityPreview(view, { type: 'bogus' } as unknown as Action)).toThrow(
      'Unknown action type',
    )
  })
})
