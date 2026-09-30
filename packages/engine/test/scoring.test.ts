import { describe, expect, it } from 'vitest'
import { scorePlayer, scoreRound, tableScore } from '../src/scoring'
import { cards, makePlayer, meld } from './fixtures'

describe('scorePlayer', () => {
  it('adds meld points, canasta bonus and red 3s, and subtracts the hand', () => {
    const player = makePlayer({
      id: 'a',
      melds: [meld('Kh Kd Ks Kc Kh Kd Ks'), meld('5h 5d 2c')],
      red3s: cards('3h'),
      hand: cards('Ah 4c'),
    })
    expect(scorePlayer(player, null)).toEqual({
      meldPoints: 100,
      canastaBonus: 500,
      red3Points: 100,
      goingOutBonus: 0,
      concealedBonus: 0,
      handPenalty: 25,
      total: 675,
    })
  })

  it('gives 300 for a mixed canasta', () => {
    const player = makePlayer({ id: 'a', melds: [meld('Kh Kd Ks Kc 2h 2d JK')] })
    const score = scorePlayer(player, null)
    expect(score.meldPoints).toBe(130)
    expect(score.canastaBonus).toBe(300)
  })

  it('turns red 3s into a penalty when the player never melded', () => {
    const player = makePlayer({ id: 'a', red3s: cards('3h 3d'), hand: cards('4c') })
    const score = scorePlayer(player, null)
    expect(score.red3Points).toBe(-200)
    expect(score.total).toBe(-205)
  })

  it('gives the going-out bonus only to the player who went out', () => {
    const player = makePlayer({ id: 'a', melds: [meld('5h 5d 5s 5c 5h 5d 5s')] })
    expect(scorePlayer(player, 'a').goingOutBonus).toBe(100)
    expect(scorePlayer(player, 'b').goingOutBonus).toBe(0)
    expect(scorePlayer(player, null).goingOutBonus).toBe(0)
  })

  it('adds the concealed hand bonus when the player had no melds before going out', () => {
    const melds = [meld('5h 5d 5s 5c 5h 5d 5s')]
    const concealed = makePlayer({ id: 'a', melds, meldedBeforeThisTurn: false })
    const open = makePlayer({ id: 'a', melds, meldedBeforeThisTurn: true })
    expect(scorePlayer(concealed, 'a').concealedBonus).toBe(200)
    expect(scorePlayer(open, 'a').concealedBonus).toBe(0)
    expect(scorePlayer(concealed, null).concealedBonus).toBe(0)
  })
})

describe('scoreRound', () => {
  it('scores every player by id', () => {
    const players = [
      makePlayer({ id: 'a', hand: cards('4c') }),
      makePlayer({ id: 'b', hand: cards('Kc') }),
    ]
    const scores = scoreRound(players, null)
    expect(scores.a.total).toBe(-5)
    expect(scores.b.total).toBe(-10)
  })
})

describe('tableScore', () => {
  it('counts melds, canasta bonuses and Red 3s, but not the hand', () => {
    const player = makePlayer({
      id: 'a',
      melds: [meld('Kh Kd Ks Kc Kh Kd 2s'), meld('5h 5d 5s')],
      red3s: cards('3h 3d'),
      hand: cards('Ah 4c'),
    })
    expect(tableScore(player)).toEqual({
      meldPoints: 95,
      canastaBonus: 300,
      red3Points: 200,
      total: 595,
    })
  })

  it('counts Red 3s against a player with no melds', () => {
    expect(tableScore({ melds: [], red3s: cards('3h') }).total).toBe(-100)
  })
})
