import type { FeedEvent, PublicPlayer } from '@canasta/engine'
import { describe, expect, it } from 'vitest'
import { describeEvent } from '../src/feed'
import { card } from './fixtures'

const players: PublicPlayer[] = [
  { id: 'a', name: 'Ann', score: 0, handCount: 0, melds: [], red3s: [], turnsThisRound: 1 },
]

describe('describeEvent', () => {
  const cases: [FeedEvent, string][] = [
    [{ type: 'drewStock', playerId: 'a', red3s: [] }, 'Ann drew a card'],
    [{ type: 'drewStock', playerId: 'a', red3s: [card('3h', 1)] }, 'Ann drew and laid down 3♥'],
    [
      {
        type: 'pickedUpPile',
        playerId: 'a',
        count: 9,
        played: { newMelds: [[card('9h', 1), card('9s', 2), card('9d', 3)]], additions: [] },
        canastas: [],
        red3s: [],
      },
      'Ann picked up 9 cards, melding 9♥ 9♠ 9♦',
    ],
    [
      {
        type: 'pickedUpPile',
        playerId: 'a',
        count: 4,
        played: { newMelds: [], additions: [{ meldId: 'm1', cards: [card('Kh', 1)] }] },
        canastas: [{ rank: 'K', natural: false }],
        red3s: [card('3d', 2)],
      },
      'Ann picked up 4 cards, melding K♥, completing a mixed canasta of Kings, and laid down 3♦',
    ],
    [
      {
        type: 'melded',
        playerId: 'a',
        played: {
          newMelds: [[card('5h', 1), card('5s', 2), card('JK', 3)]],
          additions: [{ meldId: 'm1', cards: [card('Kd', 4)] }],
        },
        canastas: [],
      },
      'Ann melded 5♥ 5♠ Joker K♦',
    ],
    [
      {
        type: 'melded',
        playerId: 'a',
        played: { newMelds: [], additions: [{ meldId: 'm1', cards: [card('Qd', 4)] }] },
        canastas: [{ rank: 'Q', natural: true }],
      },
      'Ann melded Q♦, completing a clean canasta of Queens',
    ],
    [{ type: 'quit', playerId: 'z', name: 'Zed' }, 'Zed quit the game'],
    [{ type: 'discarded', playerId: 'a', card: card('7h', 1) }, 'Ann discarded 7♥'],
    [{ type: 'wentOut', playerId: 'a' }, 'Ann went out'],
    [{ type: 'stockOut' }, 'The stock ran out. The round is over.'],
  ]

  it.each(cases)('%j', (event, text) => {
    expect(describeEvent(event, players)).toBe(text)
  })

  it('names a player who has since quit', () => {
    const quit = [{ id: 'z', name: 'Zed', score: 0, round: 1 }]
    expect(describeEvent({ type: 'wentOut', playerId: 'z' }, players, quit)).toBe('Zed went out')
  })
})
