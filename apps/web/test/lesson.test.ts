import { applyAction, type Action, type Game } from '@canasta/engine'
import { describe, expect, it } from 'vitest'
import { advance, lessonGame, player, playDot, STEPS, YOU, isTurnOf } from '../src/tutorial/lesson'

const ids = (game: Game, ...codes: string[]) => {
  const hand = [...player(game, YOU).hand]
  return codes.map((code) => {
    const i = hand.findIndex((c) => `${c.rank}${c.suit?.[0] ?? ''}` === code)
    if (i === -1) throw new Error(`No ${code} in hand`)
    return hand.splice(i, 1)[0].id
  })
}

function play(game: Game, step: number, action: Action): { game: Game; step: number } {
  const { allow } = STEPS[step]
  expect(allow ? allow(action, game) : 'every move waits').toBeNull()
  const result = applyAction(game, YOU, action)
  if (!result.ok) throw new Error(result.error.message)
  return { game: result.game, step: advance(step, result.game) }
}

function dotPlays(game: Game, step: number): { game: Game; step: number } {
  while (!isTurnOf(game, YOU)) game = playDot(game)
  return { game, step: advance(step, game) }
}

describe('the practice hand', () => {
  it('deals you the lesson cards and lets you play first', () => {
    const game = lessonGame()
    expect(player(game, YOU).hand).toHaveLength(15)
    expect(isTurnOf(game, YOU)).toBe(true)
    expect(game.round!.discard.map((c) => c.rank)).toEqual(['5'])
  })

  it('plays through every step to you going out', () => {
    let s = { game: lessonGame(), step: 2 }
    s = play(s.game, s.step, { type: 'drawStock' })
    expect(STEPS[s.step].title).toBe('Make your first meld')
    s = play(s.game, s.step, {
      type: 'meld',
      play: { newMelds: [ids(s.game, 'As', 'Ah', 'Ad')], additions: [] },
    })
    s = play(s.game, s.step, { type: 'discard', cardId: ids(s.game, '4c')[0] })
    expect(STEPS[s.step].title).toBe("Dot's turn")
    s = dotPlays(s.game, s.step)
    expect(STEPS[s.step].title).toBe('Pick up the pile')
    expect(s.game.round!.discard.at(-1)).toMatchObject({ rank: '9', suit: 'diamonds' })

    const top = s.game.round!.discard.at(-1)!.id
    s = play(s.game, s.step, {
      type: 'pickUpPile',
      play: { newMelds: [[top, ...ids(s.game, '9s', '9c')]], additions: [] },
    })
    expect(STEPS[s.step].title).toBe('Make a canasta')
    const aces = player(s.game, YOU).melds.find((m) => m.rank === 'A')!
    s = play(s.game, s.step, {
      type: 'meld',
      play: {
        newMelds: [],
        additions: [{ meldId: aces.id, cardIds: ids(s.game, 'Ac', 'As', 'Ah', '2h') }],
      },
    })
    expect(STEPS[s.step].title).toBe('Discard again')
    s = play(s.game, s.step, { type: 'discard', cardId: ids(s.game, '5s')[0] })
    s = dotPlays(s.game, s.step)
    expect(STEPS[s.step].title).toBe('Go out')

    s = play(s.game, s.step, { type: 'drawStock' })
    s = play(s.game, s.step, {
      type: 'meld',
      play: {
        newMelds: [ids(s.game, 'Ks', 'Kd', 'Kc', 'Kh'), ids(s.game, '7s', '7d', '7c')],
        additions: [],
      },
    })
    s = play(s.game, s.step, { type: 'discard', cardId: ids(s.game, '4c')[0] })
    expect(s.game.history[0].wentOut).toBe(YOU)
    expect(STEPS[s.step].title).toBe('You went out!')
  })

  it('refuses moves that would leave the script', () => {
    const game = lessonGame()
    const pickUp: Action = { type: 'pickUpPile', play: { newMelds: [], additions: [] } }
    expect(STEPS[2].allow!(pickUp, game)).toBe('Start by drawing from the stock.')
    const drawn = applyAction(game, YOU, { type: 'drawStock' })
    if (!drawn.ok) throw new Error(drawn.error.message)
    const kings: Action = {
      type: 'meld',
      play: { newMelds: [ids(drawn.game, 'Ks', 'Kd', 'Kc')], additions: [] },
    }
    expect(STEPS[3].allow!(kings, drawn.game)).toBe('For this lesson, meld only aces.')
  })
})
