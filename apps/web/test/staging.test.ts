import { describe, expect, it } from 'vitest'
import {
  emptyStaging,
  reconcile,
  stagingPreview,
  stagingReducer,
  toBatch,
  type Staging,
  type StagingAction,
} from '../src/staging'
import { card, makeView } from './fixtures'

const run = (...actions: StagingAction[]): Staging => actions.reduce(stagingReducer, emptyStaging)

describe('staging reducer', () => {
  it('toggles selection and stages it as a new meld', () => {
    const staging = run(
      { type: 'toggle', cardId: 1 },
      { type: 'toggle', cardId: 2 },
      { type: 'toggle', cardId: 2 },
      { type: 'toggle', cardId: 3 },
      { type: 'stageNew' },
    )
    expect(staging).toEqual({ selected: [], groups: [{ meldId: null, cardIds: [1, 3] }] })
  })

  it('merges additions to the same meld and ignores staged cards when toggled', () => {
    const staging = run(
      { type: 'toggle', cardId: 1 },
      { type: 'stageAdd', meldId: 'm1' },
      { type: 'toggle', cardId: 1 },
      { type: 'toggle', cardId: 2 },
      { type: 'stageAdd', meldId: 'm1' },
    )
    expect(staging.groups).toEqual([{ meldId: 'm1', cardIds: [1, 2] }])
    expect(staging.selected).toEqual([])
  })

  it('unstages a card and drops groups that become empty', () => {
    const staging = run(
      { type: 'toggle', cardId: 1 },
      { type: 'stageNew' },
      { type: 'unstage', cardId: 1 },
    )
    expect(staging).toEqual(emptyStaging)
  })

  it('builds a batch from groups plus the current selection', () => {
    const staging = run(
      { type: 'toggle', cardId: 1 },
      { type: 'stageAdd', meldId: 'm1' },
      { type: 'toggle', cardId: 2 },
      { type: 'toggle', cardId: 3 },
      { type: 'stageNew' },
      { type: 'toggle', cardId: 4 },
    )
    expect(toBatch(staging)).toEqual({
      newMelds: [[2, 3], [4]],
      additions: [{ meldId: 'm1', cardIds: [1] }],
    })
  })
})

describe('reconcile', () => {
  it('drops cards that left the hand and additions to melds that are gone', () => {
    const staging: Staging = {
      selected: [1, 9],
      groups: [
        { meldId: 'gone', cardIds: [2] },
        { meldId: null, cardIds: [3, 8] },
      ],
    }
    const next = reconcile(staging, { cardIds: new Set([1, 2, 3]), meldIds: new Set() })
    expect(next).toEqual({ selected: [1], groups: [{ meldId: null, cardIds: [3] }] })
  })

  it('returns the same object when nothing changed', () => {
    const staging: Staging = { selected: [1], groups: [] }
    expect(reconcile(staging, { cardIds: new Set([1]), meldIds: new Set() })).toBe(staging)
  })
})

describe('stagingPreview', () => {
  const nines = [card('9h', 1), card('9s', 2), card('9d', 3)]

  it('previews a meld in the play phase', () => {
    const view = makeView({ hand: [...nines, card('4c', 4), card('5c', 5)], phase: 'play' })
    const preview = stagingPreview(view, { selected: [1, 2, 3], groups: [] })
    expect(preview).toMatchObject({ kind: 'meld', error: { code: 'INITIAL_MELD_TOO_LOW' } })
  })

  it('treats one selected card in the play phase as a discard', () => {
    const view = makeView({ hand: nines, phase: 'play' })
    expect(stagingPreview(view, { selected: [2], groups: [] })).toMatchObject({
      kind: 'discard',
      action: { type: 'discard', cardId: 2 },
      error: null,
    })
  })

  it('previews a pickup in the draw phase', () => {
    const view = makeView({
      hand: [card('9s', 2), card('9d', 3)],
      phase: 'draw',
      top: card('9h', 1),
    })
    expect(stagingPreview(view, { selected: [1, 2, 3], groups: [] })).toMatchObject({
      kind: 'pickUpPile',
      error: { code: 'INITIAL_MELD_TOO_LOW' },
    })
  })

  it('shows nothing when nothing is selected', () => {
    expect(stagingPreview(makeView({ hand: nines, phase: 'play' }), emptyStaging)).toEqual({
      kind: 'none',
    })
  })
})
