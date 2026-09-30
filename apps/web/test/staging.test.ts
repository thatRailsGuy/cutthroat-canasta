import { describe, expect, it } from 'vitest'
import {
  emptyStaging,
  reconcile,
  stagingPreview,
  stagingReducer,
  pickupHelpers,
  selectionTarget,
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

describe('selectionTarget', () => {
  const nines = {
    id: 'm1',
    rank: '9' as const,
    cards: [card('9c', 10), card('9c', 11), card('9d', 12)],
  }
  const hand = [card('9h', 1), card('9s', 2), card('JK', 3), card('Kd', 4)]

  it('sends selected cards of a rank to your unfinished meld of it', () => {
    const view = makeView({ hand, phase: 'play', melds: [nines] })
    expect(selectionTarget(view, [1, 2, 3])).toBe('m1')
    expect(toBatch({ selected: [1, 2, 3], groups: [] }, 'm1')).toEqual({
      newMelds: [],
      additions: [{ meldId: 'm1', cardIds: [1, 2, 3] }],
    })
  })

  it('includes the top discard when picking up the pile', () => {
    const view = makeView({ hand, phase: 'draw', melds: [nines], top: card('9d', 900) })
    expect(selectionTarget(view, [900, 1, 2])).toBe('m1')
  })

  it('makes a new meld once your meld of that rank is a canasta', () => {
    const canasta = {
      ...nines,
      cards: [...nines.cards, ...[20, 21, 22, 23].map((id) => card('9h', id))],
    }
    const view = makeView({ hand, phase: 'play', melds: [canasta] })
    expect(selectionTarget(view, [1, 2, 3])).toBeNull()
  })

  it('makes a new meld for mixed ranks or a rank you have no meld of', () => {
    const view = makeView({ hand, phase: 'play', melds: [nines] })
    expect(selectionTarget(view, [1, 4])).toBeNull()
    expect(selectionTarget(makeView({ hand, phase: 'play' }), [1, 2])).toBeNull()
  })
})

describe('pickupHelpers', () => {
  const top = card('7h', 900)
  const sevens = {
    id: 'm1',
    rank: '7' as const,
    cards: [card('7c', 10), card('7d', 11), card('7s', 12)],
  }
  const view = (
    hand: ReturnType<typeof card>[],
    opts: { melds?: (typeof sevens)[]; picked?: boolean } = {},
  ) =>
    makeView({ hand, phase: 'draw', top, melds: opts.melds, hasPickedUpPile: opts.picked ?? true })
  const hand = [card('7s', 1), card('7d', 2), card('JK', 3), card('2c', 4), card('Kd', 5)]

  it('selects nothing more when the top card can join your unfinished meld', () => {
    expect(pickupHelpers(view(hand, { melds: [sevens] }), emptyStaging)).toEqual([])
  })

  it('selects a natural pair to start a meld', () => {
    expect(pickupHelpers(view(hand), emptyStaging)).toEqual([1, 2])
  })

  it('selects one natural and a wild, a Joker before a 2, when you hold one natural', () => {
    expect(
      pickupHelpers(view([card('7s', 1), card('JK', 3), card('2c', 4)]), emptyStaging),
    ).toEqual([1, 3])
  })

  it('counts cards you already selected toward the pair', () => {
    expect(pickupHelpers(view(hand), { selected: [2], groups: [] })).toEqual([1])
  })

  it('needs a new meld once your meld of the rank is a canasta', () => {
    const canasta = {
      ...sevens,
      cards: [...sevens.cards, ...[20, 21, 22, 23].map((id) => card('7c', id))],
    }
    expect(pickupHelpers(view(hand, { melds: [canasta] }), emptyStaging)).toEqual([1, 2])
  })

  describe('when frozen for you', () => {
    it('selects a natural pair, even with an unfinished meld of the rank', () => {
      expect(pickupHelpers(view(hand, { picked: false }), emptyStaging)).toEqual([1, 2])
      expect(pickupHelpers(view(hand, { melds: [sevens], picked: false }), emptyStaging)).toEqual([
        1, 2,
      ])
    })

    it('never makes up the pair with a wild', () => {
      expect(
        pickupHelpers(view([card('7s', 1), card('2c', 4)], { picked: false }), emptyStaging),
      ).toEqual([])
    })
  })

  it('selects the helpers with the top card, but only when selecting it', () => {
    const selected = stagingReducer(emptyStaging, { type: 'toggle', cardId: 900, also: [1, 2] })
    expect(selected.selected).toEqual([900, 1, 2])
    const deselected = stagingReducer(selected, { type: 'toggle', cardId: 900, also: [1, 2] })
    expect(deselected.selected).toEqual([1, 2])
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
