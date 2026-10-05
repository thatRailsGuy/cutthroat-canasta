import type { Meld } from '@canasta/engine'
import { describe, expect, it } from 'vitest'
import { dropVerdict, joinsStagedMeld, parseDropTarget } from '../src/drops'
import { emptyStaging } from '../src/staging'
import { card, makeView } from './fixtures'

const hand = [
  card('9h', 1),
  card('9c', 2),
  card('Kd', 3),
  card('Ks', 4),
  card('Kh', 5),
  card('3c', 6),
  card('2d', 7),
]
const nines: Meld = { id: 'm1', rank: '9', cards: [card('9s', 10), card('9d', 11), card('9h', 12)] }
const play = () => makeView({ hand, phase: 'play', melds: [nines] })

describe('parseDropTarget', () => {
  it('reads the data-drop values', () => {
    expect(parseDropTarget('meld:m1')).toEqual({ kind: 'meld', meldId: 'm1' })
    expect(parseDropTarget('pile')).toEqual({ kind: 'pile' })
    expect(parseDropTarget('somewhere')).toBeNull()
  })
})

describe('dropVerdict', () => {
  it('lets you move one card within your hand at any time', () => {
    const view = makeView({ hand, phase: 'draw' })
    view.round!.current = 1
    expect(dropVerdict(view, emptyStaging, { kind: 'hand' }, [1])).toEqual({ ok: true })
    expect(dropVerdict(view, emptyStaging, { kind: 'hand' }, [1, 2])).toBeNull()
  })

  it('offers nothing to play on before the draw or out of turn', () => {
    const draw = makeView({ hand, phase: 'draw', melds: [nines] })
    expect(dropVerdict(draw, emptyStaging, { kind: 'pile' }, [3])).toBeNull()
    const theirs = play()
    theirs.round!.current = 1
    expect(dropVerdict(theirs, emptyStaging, { kind: 'meld', meldId: 'm1' }, [1])).toBeNull()
  })

  it('takes a card of the meld’s rank on the meld, and says why not for another', () => {
    const view = play()
    expect(dropVerdict(view, emptyStaging, { kind: 'meld', meldId: 'm1' }, [1, 2])).toEqual({
      ok: true,
    })
    expect(dropVerdict(view, emptyStaging, { kind: 'meld', meldId: 'm1' }, [3])).toMatchObject({
      ok: false,
    })
  })

  it('starts a new meld of one rank, but sends cards with an unfinished meld there', () => {
    const view = play()
    expect(dropVerdict(view, emptyStaging, { kind: 'new' }, [3, 4, 7])).toEqual({ ok: true })
    expect(dropVerdict(view, emptyStaging, { kind: 'new' }, [3, 1])).toEqual({
      ok: false,
      why: 'A meld is cards of one rank, plus wilds.',
    })
    expect(dropVerdict(view, emptyStaging, { kind: 'new' }, [6])).toEqual({
      ok: false,
      why: '3s can never be melded.',
    })
    expect(dropVerdict(view, emptyStaging, { kind: 'new' }, [1, 2])).toEqual({
      ok: false,
      why: 'These go onto your 9s. Drop them there.',
    })
  })

  it('discards one card on the pile, once nothing is staged', () => {
    const view = play()
    expect(dropVerdict(view, emptyStaging, { kind: 'pile' }, [3])).toEqual({ ok: true })
    expect(dropVerdict(view, emptyStaging, { kind: 'pile' }, [3, 4])).toEqual({
      ok: false,
      why: 'Discard one card at a time.',
    })
    const staged = { selected: [], groups: [{ meldId: 'm1', cardIds: [1] }] }
    expect(dropVerdict(view, staged, { kind: 'pile' }, [3])).toEqual({
      ok: false,
      why: 'Meld or clear your staged cards first.',
    })
  })
})

describe('joinsStagedMeld', () => {
  it('joins the staged new meld of the same rank', () => {
    const view = play()
    const staging = {
      selected: [],
      groups: [
        { meldId: 'm1', cardIds: [1] },
        { meldId: null, cardIds: [3, 4] },
      ],
    }
    expect(joinsStagedMeld(view, staging, [5])).toBe(1)
    expect(joinsStagedMeld(view, staging, [7])).toBeUndefined()
  })
})
