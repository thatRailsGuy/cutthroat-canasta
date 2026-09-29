import { describe, expect, it } from 'vitest'
import { viewFor } from '../src/view'
import { startGame } from '../src/game'
import { lobby, unwrap, visibleCardIds } from './fixtures'

describe('viewFor', () => {
  const game = unwrap(startGame(lobby(3)))
  const view = viewFor(game, 'p0')

  it('shows your own hand in full', () => {
    expect(view.you?.hand).toEqual(game.players[0].hand)
  })

  it('shows other players only as card counts', () => {
    expect(view.players[1]).not.toHaveProperty('hand')
    expect(view.players[1].handCount).toBe(game.players[1].hand.length)
  })

  it('shows the stock only as a count, and just the top discard', () => {
    expect(view.round).not.toHaveProperty('stock')
    expect(view.round?.stockCount).toBe(game.round!.stock.length)
    expect(view.round?.discardTop).toEqual(game.round!.discard.at(-1))
  })

  it('leaves out the seed and the action log', () => {
    expect(view).not.toHaveProperty('seed')
    expect(view).not.toHaveProperty('log')
  })

  it('exposes no hidden card anywhere in the view', () => {
    const secret = new Set(
      [
        ...game.players[1].hand,
        ...game.players[2].hand,
        ...game.round!.stock,
        ...game.round!.discard.slice(0, -1),
      ].map((c) => c.id),
    )
    expect(visibleCardIds(view).filter((id) => secret.has(id))).toEqual([])
  })

  it('reveals no hands during play', () => {
    expect(view.players.map((p) => p.revealedHand)).toEqual([null, null, null])
  })

  it.each(['roundOver', 'gameOver'] as const)(
    'reveals every hand when the status is %s',
    (status) => {
      const over = viewFor({ ...game, status }, 'p0')
      expect(over.players.map((p) => p.revealedHand)).toEqual(game.players.map((p) => p.hand))
    },
  )

  it("includes the round's feed", () => {
    expect(view.round?.feed).toBe(game.round!.feed)
  })

  it('has no "you" for someone not at the table', () => {
    expect(viewFor(game, 'stranger').you).toBeNull()
  })
})
