import type { PlayerView } from '@canasta/engine'
import { describe, expect, it } from 'vitest'
import { playOrder, turnText } from '../src/turnOrder'
import { makeView } from './fixtures'

/** Four seats: Mabel, You, Otis, Dot. Mabel dealt; Otis is playing. */
function fourSeats(): PlayerView {
  const view = makeView({ hand: [], phase: 'draw' })
  const other = (id: string, name: string) => ({ ...view.players[1], id, name })
  view.players = [
    other('mabel', 'Mabel'),
    view.players[0],
    other('otis', 'Otis'),
    other('dot', 'Dot'),
  ]
  view.round = { ...view.round!, dealer: 0, current: 2 }
  return view
}

const names = (view: PlayerView, first: number) =>
  playOrder(view.players, first).map(({ player }) => player.name)

describe('playOrder', () => {
  it('lists everyone from the given seat, passing up the seats and wrapping round', () => {
    const view = fourSeats()
    expect(names(view, 1)).toEqual(['You', 'Otis', 'Dot', 'Mabel'])
    expect(names(view, 4)).toEqual(['Mabel', 'You', 'Otis', 'Dot'])
    expect(playOrder(view.players, 3).map(({ seat }) => seat)).toEqual([3, 0, 1, 2])
  })
})

describe('turnText', () => {
  it('says who is playing and whom you follow', () => {
    expect(turnText(fourSeats(), false)).toBe("Otis is playing. You're up after Mabel.")
  })

  it('says when you are up next', () => {
    const view = fourSeats()
    view.round!.current = 0
    expect(turnText(view, false)).toBe("Mabel is playing. You're up next.")
  })

  it('tells you what to do on your turn', () => {
    expect(turnText(makeView({ hand: [], phase: 'draw' }), true)).toBe(
      'Your turn: draw or pick up the pile',
    )
    expect(turnText(makeView({ hand: [], phase: 'play' }), true)).toBe(
      'Your turn: meld, then discard',
    )
  })
})
