import type { FeedEvent, PlayerView } from '@canasta/engine'
import { afterEach, describe, expect, it } from 'vitest'
import { MAX_ANIMATED_EVENTS } from '../src/effects'
import { audible, CHAT_CLINK_GAP, clinkDue, cuesFor, snapshotOf, type Cue } from '../src/sounds'
import { loadChatSound, loadSoundLevel, saveChatSound, saveSoundLevel } from '../src/storage'
import { card, makeView } from './fixtures'

const noPlay = { newMelds: [], additions: [] }

/** A view where it is Bob's turn (seat 1), with these events in the feed. */
function bobsTurn(feed: FeedEvent[] = []): PlayerView {
  const view = makeView({ hand: [card('5h', 1)], phase: 'play' })
  view.round!.current = 1
  view.round!.feed = feed
  return view
}

/** The next view after `view`: the same deal, with more events and maybe a new turn. */
function next(view: PlayerView, events: FeedEvent[], current = view.round!.current): PlayerView {
  return { ...view, round: { ...view.round!, current, feed: [...view.round!.feed, ...events] } }
}

const sounds = (cues: Cue[]) => cues.map((c) => `${c.sound}${c.mine ? '' : ' (theirs)'}`)

describe('cuesFor', () => {
  it('plays nothing for the first view, so a reconnect stays quiet', () => {
    expect(cuesFor(null, bobsTurn([{ type: 'drewStock', playerId: 'bob', red3s: [] }]))).toEqual([])
  })

  it('plays an opponent’s discard, then your turn', () => {
    const before = bobsTurn([{ type: 'drewStock', playerId: 'bob', red3s: [] }])
    const after = next(before, [{ type: 'discarded', playerId: 'bob', card: card('9c', 2) }], 0)
    expect(sounds(cuesFor(snapshotOf(before), after))).toEqual(['discard (theirs)', 'turn'])
  })

  it('plays your own moves as yours, with a tap for each card melded', () => {
    const before = makeView({ hand: [card('5h', 1)], phase: 'draw' })
    const after = next(before, [
      { type: 'drewStock', playerId: 'you', red3s: [] },
      {
        type: 'melded',
        playerId: 'you',
        played: {
          newMelds: [[card('7h', 3), card('7d', 4), card('7s', 5)]],
          additions: [{ meldId: 'm1', cards: [card('Kc', 6)] }],
        },
        canastas: [{ rank: 'K', natural: true }],
      },
    ])
    const cues = cuesFor(snapshotOf(before), after)
    expect(cues).toEqual([
      { sound: 'draw', mine: true },
      { sound: 'meld', mine: true, cards: 4 },
      { sound: 'canasta', mine: true },
    ])
  })

  it('plays a pickup, then the canasta it made', () => {
    const before = bobsTurn()
    const after = next(before, [
      {
        type: 'pickedUpPile',
        playerId: 'bob',
        count: 6,
        played: noPlay,
        canastas: [{ rank: '8', natural: false }],
        red3s: [],
      },
    ])
    expect(sounds(cuesFor(snapshotOf(before), after))).toEqual([
      'pickup (theirs)',
      'canasta (theirs)',
    ])
  })

  it('drops a coin for red 3s drawn, or taken with the pile before its canasta', () => {
    const before = makeView({ hand: [card('5h', 1)], phase: 'draw' })
    const drawn = next(before, [
      { type: 'drewStock', playerId: 'you', red3s: [card('3h', 7), card('3d', 8)] },
    ])
    expect(sounds(cuesFor(snapshotOf(before), drawn))).toEqual(['draw', 'red3'])

    const bobBefore = bobsTurn()
    const taken = next(bobBefore, [
      {
        type: 'pickedUpPile',
        playerId: 'bob',
        count: 6,
        played: noPlay,
        canastas: [{ rank: '8', natural: false }],
        red3s: [card('3h', 9)],
      },
    ])
    expect(sounds(cuesFor(snapshotOf(bobBefore), taken))).toEqual([
      'pickup (theirs)',
      'red3 (theirs)',
      'canasta (theirs)',
    ])
  })

  it('plays no moves for a catch-up of many events at once', () => {
    const before = bobsTurn()
    const events: FeedEvent[] = Array.from({ length: MAX_ANIMATED_EVENTS + 1 }, () => ({
      type: 'drewStock',
      playerId: 'bob',
      red3s: [],
    }))
    expect(cuesFor(snapshotOf(before), next(before, events))).toEqual([])
  })

  it('does not ring your turn again while it stays your turn', () => {
    const before = makeView({ hand: [card('5h', 1)], phase: 'draw' })
    const after = next(before, [{ type: 'drewStock', playerId: 'you', red3s: [] }])
    expect(sounds(cuesFor(snapshotOf(before), after))).toEqual(['draw'])
  })

  it('rings your turn when the game starts with you', () => {
    const lobby = { ...makeView({ hand: [], phase: 'draw' }), status: 'lobby' as const }
    lobby.round = null
    const dealt = makeView({ hand: [card('5h', 1)], phase: 'draw' })
    expect(sounds(cuesFor(snapshotOf(lobby), dealt))).toEqual(['turn'])
  })

  it('rings your turn when a new round deals to you first', () => {
    const over = { ...bobsTurn(), status: 'roundOver' as const }
    const dealt = makeView({ hand: [card('5h', 1)], phase: 'draw' })
    dealt.round!.number = 2
    expect(sounds(cuesFor(snapshotOf(over), dealt))).toEqual(['turn'])
  })

  it('plays the end of a round once, and only game over when the game ends', () => {
    const before = bobsTurn()
    const went = next(before, [{ type: 'wentOut', playerId: 'bob' }])
    expect(sounds(cuesFor(snapshotOf(before), { ...went, status: 'roundOver' }))).toEqual([
      'roundOver',
    ])
    expect(sounds(cuesFor(snapshotOf(before), { ...went, status: 'gameOver' }))).toEqual([
      'gameOver',
    ])
    const over = { ...went, status: 'roundOver' as const }
    expect(cuesFor(snapshotOf(over), over)).toEqual([])
  })

  it('gives a player watching from the side only other players’ moves', () => {
    const before = bobsTurn()
    before.you = null
    const after = next(before, [{ type: 'discarded', playerId: 'bob', card: card('9c', 2) }], 0)
    expect(sounds(cuesFor(snapshotOf(before), after))).toEqual(['discard (theirs)'])
  })
})

describe('audible', () => {
  const turn: Cue = { sound: 'turn', mine: true }
  const roundOver: Cue = { sound: 'roundOver', mine: true }
  const yourDiscard: Cue = { sound: 'discard', mine: true }
  const theirDiscard: Cue = { sound: 'discard', mine: false }
  const heard = (level: 0 | 1 | 2 | 3) =>
    [turn, roundOver, yourDiscard, theirDiscard].map((cue) => audible(cue, level))

  it('adds more at each step', () => {
    expect(heard(0)).toEqual([false, false, false, false])
    expect(heard(1)).toEqual([true, true, false, false])
    expect(heard(2)).toEqual([true, true, true, false])
    expect(heard(3)).toEqual([true, true, true, true])
  })
})

describe('the chat clink', () => {
  it('plays at every step but Off', () => {
    const chat: Cue = { sound: 'chat', mine: true }
    expect([0, 1, 2, 3].map((level) => audible(chat, level as 0 | 1 | 2 | 3))).toEqual([
      false,
      true,
      true,
      true,
    ])
  })

  it('clinks once for a burst of lines', () => {
    expect(clinkDue(null, 500)).toBe(true)
    expect(clinkDue(500, 500 + CHAT_CLINK_GAP - 1)).toBe(false)
    expect(clinkDue(500, 500 + CHAT_CLINK_GAP)).toBe(true)
  })
})

describe('the chat sound in storage', () => {
  afterEach(() => localStorage.clear())

  it('starts on, and keeps the choice', () => {
    expect(loadChatSound()).toBe(true)
    saveChatSound(false)
    expect(loadChatSound()).toBe(false)
    saveChatSound(true)
    expect(localStorage.getItem('canasta:chatSound')).toBeNull()
  })
})

describe('the sound level in storage', () => {
  afterEach(() => localStorage.clear())

  it('starts on My plays, and keeps the choice', () => {
    expect(loadSoundLevel()).toBe(2)
    saveSoundLevel(0)
    expect(loadSoundLevel()).toBe(0)
  })

  it('ignores a value it does not know', () => {
    localStorage.setItem('canasta:soundLevel', 'loud')
    expect(loadSoundLevel()).toBe(2)
  })
})
