import type { PlayerView } from '@canasta/engine'
import { describe, expect, it } from 'vitest'
import { announcements, chatAnnouncement } from '../src/announce'
import { card, makeView } from './fixtures'

/** Bob's turn, so the next view can hand the turn to you. */
function bobsTurn(): PlayerView {
  const view = makeView({ hand: [], phase: 'draw' })
  return { ...view, round: { ...view.round!, current: 1 } }
}

function withRound(view: PlayerView, changes: Partial<NonNullable<PlayerView['round']>>) {
  return { ...view, round: { ...view.round!, ...changes } }
}

describe('announcements', () => {
  it('says nothing for the first view', () => {
    expect(
      announcements(null, makeView({ hand: [], phase: 'draw' }), 'you', { events: true }),
    ).toEqual([])
  })

  it("says Bob's discard in words, then that it's your turn", () => {
    const before = bobsTurn()
    const after = withRound(before, {
      current: 0,
      feed: [{ type: 'discarded', playerId: 'bob', card: card('7h', 5) }],
    })
    expect(announcements(before, after, 'you', { events: true })).toEqual([
      'Bob discarded 7 of hearts',
      'Your turn.',
    ])
  })

  it("leaves out the others' moves when the event log can say them", () => {
    const before = bobsTurn()
    const after = withRound(before, {
      current: 0,
      feed: [{ type: 'discarded', playerId: 'bob', card: card('7h', 5) }],
    })
    expect(announcements(before, after, 'you', { events: false })).toEqual(['Your turn.'])
  })

  it('leaves out your own moves', () => {
    const before = makeView({ hand: [], phase: 'draw' })
    const after = withRound(before, {
      phase: 'play',
      feed: [{ type: 'drewStock', playerId: 'you', red3s: [] }],
    })
    expect(announcements(before, after, 'you', { events: true })).toEqual([])
  })

  it("says it's your turn when a new deal starts with you", () => {
    const before = makeView({ hand: [], phase: 'draw' })
    const after = withRound(before, { number: 2, feed: [] })
    expect(announcements(before, after, 'you', { events: true })).toEqual(['Your turn.'])
  })

  it('says the round is over', () => {
    const before = makeView({ hand: [], phase: 'play' })
    const after: PlayerView = { ...before, status: 'roundOver' }
    expect(announcements(before, after, 'you', { events: false })).toEqual(['Round 1 is over.'])
  })

  it('names the winner when the game ends', () => {
    const before = makeView({ hand: [], phase: 'play' })
    const after: PlayerView = { ...before, status: 'gameOver', winners: ['bob'] }
    expect(announcements(before, after, 'you', { events: false })).toEqual(['Game over. Bob wins.'])
  })
})

describe('chatAnnouncement', () => {
  const line = {
    id: 1,
    playerId: 'bob',
    name: 'Bob',
    text: 'nice meld',
    at: 0,
    anchor: { game: 1, round: 1, redeals: 0, after: 0 },
  }

  it("says someone else's line with their name", () => {
    expect(chatAnnouncement(line, 'you')).toBe('Bob says: nice meld')
  })

  it('stays quiet for your own line', () => {
    expect(chatAnnouncement({ ...line, playerId: 'you' }, 'you')).toBeNull()
  })
})
