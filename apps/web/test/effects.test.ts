import type { FeedEvent } from '@canasta/engine'
import { describe, expect, it } from 'vitest'
import { effectsFor, MAX_ANIMATED_EVENTS } from '../src/effects'
import { card } from './fixtures'

const noPlay = { newMelds: [], additions: [] }
const ctx = { youId: 'a', drawn: card('7h', 5), previousTop: card('Qs', 9) }

describe('effectsFor', () => {
  it('shows your drawn card, but not an opponent’s', () => {
    const events: FeedEvent[] = [
      { type: 'drewStock', playerId: 'a', red3s: [] },
      { type: 'drewStock', playerId: 'b', red3s: [] },
    ]
    expect(effectsFor(events, ctx)).toEqual([
      { kind: 'draw', playerId: 'a', card: ctx.drawn },
      { kind: 'draw', playerId: 'b', card: null },
    ])
  })

  it('pops the red 3s laid down with a draw', () => {
    const events: FeedEvent[] = [
      { type: 'drewStock', playerId: 'b', red3s: [card('3h', 1), card('3d', 2)] },
    ]
    expect(effectsFor(events, ctx)).toContainEqual({ kind: 'red3', playerId: 'b', count: 2 })
  })

  it('flies the pile, then stamps the canastas it completed', () => {
    const events: FeedEvent[] = [
      {
        type: 'pickedUpPile',
        playerId: 'b',
        count: 8,
        played: noPlay,
        canastas: [{ rank: 'K', natural: true }],
        red3s: [],
      },
    ]
    expect(effectsFor(events, ctx)).toEqual([
      { kind: 'pickup', playerId: 'b', count: 8, top: ctx.previousTop },
      { kind: 'canasta', playerId: 'b', rank: 'K', natural: true },
    ])
  })

  it('stamps a canasta completed by a meld, and ignores discards', () => {
    const events: FeedEvent[] = [
      { type: 'melded', playerId: 'a', played: noPlay, canastas: [{ rank: '7', natural: false }] },
      { type: 'discarded', playerId: 'a', card: card('4c', 3) },
    ]
    expect(effectsFor(events, ctx)).toEqual([
      { kind: 'canasta', playerId: 'a', rank: '7', natural: false },
    ])
  })

  it('animates nothing when many events arrive at once, as after a reconnect', () => {
    const events: FeedEvent[] = Array.from({ length: MAX_ANIMATED_EVENTS + 1 }, () => ({
      type: 'drewStock' as const,
      playerId: 'b',
      red3s: [],
    }))
    expect(effectsFor(events, ctx)).toEqual([])
  })
})
