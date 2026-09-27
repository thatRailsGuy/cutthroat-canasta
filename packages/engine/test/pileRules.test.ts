import { describe, expect, it } from 'vitest'
import { checkPickupShape, isPileFrozenFor, type PileState } from '../src/pileRules'
import type { Card } from '../src/cards'
import type { MeldBatch } from '../src/types'
import { card, cards, ids, makePlayer, meld } from './fixtures'

const pile = (top: Card | null, pileFrozenForAll = false): PileState => ({ top, pileFrozenForAll })
const newMeld = (list: Card[]): MeldBatch => ({ newMelds: [ids(list)], additions: [] })

describe('isPileFrozenFor', () => {
  it('is frozen until the player has picked up the pile this round', () => {
    expect(isPileFrozenFor(makePlayer({ id: 'a', hasPickedUpPile: false }), pile(card('9h')))).toBe(
      true,
    )
    expect(isPileFrozenFor(makePlayer({ id: 'a', hasPickedUpPile: true }), pile(card('9h')))).toBe(
      false,
    )
  })

  it('is frozen for everyone while a wild is in the pile', () => {
    const player = makePlayer({ id: 'a', hasPickedUpPile: true })
    expect(isPileFrozenFor(player, pile(card('9h'), true))).toBe(true)
  })
})

describe('checkPickupShape', () => {
  it('rejects an empty pile', () => {
    const player = makePlayer({ id: 'a' })
    expect(checkPickupShape(player, pile(null), newMeld([]))?.code).toBe('PILE_EMPTY')
  })

  it.each(['JK', '2c', '3s', '3c'])('blocks pickup while %s is on top', (code) => {
    const top = card(code)
    const player = makePlayer({ id: 'a', hand: cards('9s 9d'), hasPickedUpPile: true })
    expect(checkPickupShape(player, pile(top), newMeld([top, ...player.hand]))?.code).toBe(
      'PILE_BLOCKED',
    )
  })

  it('requires the top card to be placed in the play', () => {
    const top = card('9h')
    const player = makePlayer({ id: 'a', hand: cards('Ks Kd Kc'), hasPickedUpPile: true })
    expect(checkPickupShape(player, pile(top), newMeld(player.hand))?.code).toBe(
      'PICKUP_TOP_CARD_NOT_PLACED',
    )
  })

  describe('when frozen for the player', () => {
    it('accepts a natural pair from hand', () => {
      const top = card('9h')
      const player = makePlayer({ id: 'a', hand: cards('9s 9d Kc'), hasPickedUpPile: false })
      const [a, b] = player.hand
      expect(checkPickupShape(player, pile(top), newMeld([top, a, b]))).toBeNull()
    })

    it('rejects a natural plus a wild', () => {
      const top = card('9h')
      const player = makePlayer({ id: 'a', hand: cards('9s JK Kc'), hasPickedUpPile: false })
      const [a, b] = player.hand
      expect(checkPickupShape(player, pile(top), newMeld([top, a, b]))?.code).toBe(
        'FROZEN_NEEDS_NATURAL_PAIR',
      )
    })

    it('rejects adding the top card to an existing meld', () => {
      const top = card('9h')
      const nines = meld('9c 9s 9d')
      const player = makePlayer({ id: 'a', melds: [nines], hasPickedUpPile: false })
      const batch: MeldBatch = {
        newMelds: [],
        additions: [{ meldId: nines.id, cardIds: [top.id] }],
      }
      expect(checkPickupShape(player, pile(top), batch)?.code).toBe('FROZEN_NEEDS_NATURAL_PAIR')
    })

    it('stays frozen by a wild in the pile even after a pickup', () => {
      const top = card('9h')
      const player = makePlayer({ id: 'a', hand: cards('9s JK'), hasPickedUpPile: true })
      expect(checkPickupShape(player, pile(top, true), newMeld([top, ...player.hand]))?.code).toBe(
        'FROZEN_NEEDS_NATURAL_PAIR',
      )
    })
  })

  describe('when not frozen for the player', () => {
    it('accepts a natural plus a wild', () => {
      const top = card('9h')
      const player = makePlayer({ id: 'a', hand: cards('9s JK'), hasPickedUpPile: true })
      expect(checkPickupShape(player, pile(top), newMeld([top, ...player.hand]))).toBeNull()
    })

    it('accepts adding the top card to an unfinished meld of that rank', () => {
      const top = card('9h')
      const nines = meld('9c 9s 9d')
      const player = makePlayer({ id: 'a', melds: [nines], hasPickedUpPile: true })
      const batch: MeldBatch = {
        newMelds: [],
        additions: [{ meldId: nines.id, cardIds: [top.id] }],
      }
      expect(checkPickupShape(player, pile(top), batch)).toBeNull()
    })

    it('rejects adding the top card to a finished canasta', () => {
      const top = card('5h')
      const canasta = meld('5c 5s 5d 5c 5s 5d 5h')
      const player = makePlayer({ id: 'a', melds: [canasta], hasPickedUpPile: true })
      const batch: MeldBatch = {
        newMelds: [],
        additions: [{ meldId: canasta.id, cardIds: [top.id] }],
      }
      expect(checkPickupShape(player, pile(top), batch)?.code).toBe('CANASTA_CANNOT_TAKE_PILE')
    })

    it('accepts starting a new meld of a rank that already has a canasta', () => {
      const top = card('5h')
      const canasta = meld('5c 5s 5d 5c 5s 5d 5h')
      const player = makePlayer({
        id: 'a',
        melds: [canasta],
        hand: cards('5s 5d'),
        hasPickedUpPile: true,
      })
      expect(checkPickupShape(player, pile(top), newMeld([top, ...player.hand]))).toBeNull()
    })
  })
})
