import type { FeedEvent } from '@canasta/engine'
import type { ChatLine } from '@canasta/server/protocol'
import { describe, expect, it } from 'vitest'
import { cleanChat, mergeTalk, recentStart } from '../src/chat'

const drew: FeedEvent = { type: 'drewStock', playerId: 'a', red3s: [] }
const went: FeedEvent = { type: 'wentOut', playerId: 'a' }
const tossed: FeedEvent = {
  type: 'discarded',
  playerId: 'a',
  card: { id: 1, rank: '4', suit: 'clubs' },
}

function line(id: number, anchor: ChatLine['anchor']): ChatLine {
  return { id, playerId: 'b', name: 'Bob', text: `line ${id}`, at: id, anchor }
}

const keys = (items: ReturnType<typeof mergeTalk>) => items.map((i) => i.key)

describe('cleanChat', () => {
  it('cleans like the server: NFKC, control characters to spaces, collapsed whitespace', () => {
    expect(cleanChat('  ｇｇ\u0007 \n wp ')).toBe('gg wp')
  })

  it('keeps the joiners inside emoji', () => {
    expect(cleanChat('👨‍👩‍👧')).toBe('👨‍👩‍👧')
  })
})

describe('mergeTalk', () => {
  const deal = { round: 2, redeals: 0 }

  it('places lines among the deal’s events by their anchors, ties in id order', () => {
    const chat = [
      line(1, { round: 2, redeals: 0, after: 1 }),
      line(2, { round: 2, redeals: 0, after: 0 }),
      line(3, { round: 2, redeals: 0, after: 1 }),
      line(4, { round: 2, redeals: 0, after: 2 }),
    ]
    expect(keys(mergeTalk([drew, went], chat, deal))).toEqual(['c2', 'e0', 'c1', 'c3', 'e1', 'c4'])
  })

  it('puts lobby, earlier-round and earlier-deal lines first', () => {
    const chat = [
      line(1, { round: null, redeals: 0, after: 0 }),
      line(2, { round: 1, redeals: 0, after: 5 }),
      line(3, { round: 2, redeals: 0, after: 1 }),
    ]
    expect(keys(mergeTalk([drew, went], chat, { round: 2, redeals: 1 }))).toEqual([
      'c1',
      'c2',
      'c3',
      'e0',
      'e1',
    ])
  })

  it('shows only chat in the lobby', () => {
    const chat = [line(1, { round: null, redeals: 0, after: 0 })]
    expect(keys(mergeTalk([], chat, null))).toEqual(['c1'])
  })
})

describe('recentStart', () => {
  it('keeps everything until two turns have ended', () => {
    expect(recentStart([drew, tossed, drew])).toBe(0)
  })

  it('keeps the last finished turn and the turn being played', () => {
    // Turn 1: drew, tossed. Turn 2: drew, tossed. Turn 3: drew.
    expect(recentStart([drew, tossed, drew, tossed, drew])).toBe(2)
  })
})

describe('mergeTalk, once older turns drop out', () => {
  it('drops older events but keeps their chat, first', () => {
    const chat = [
      line(1, { round: 1, redeals: 0, after: 1 }),
      line(2, { round: 1, redeals: 0, after: 3 }),
    ]
    expect(
      keys(mergeTalk([drew, tossed, drew, tossed, drew], chat, { round: 1, redeals: 0 })),
    ).toEqual(['c1', 'e2', 'c2', 'e3', 'e4'])
  })
})
