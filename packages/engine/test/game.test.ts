import { describe, expect, it } from 'vitest'
import { addPlayer, createGame, startGame, startNextRound } from '../src/game'
import { isRed3, isWild } from '../src/cards'
import { countCards, lobby, makeGame, makePlayer, unwrap } from './fixtures'

describe('lobby', () => {
  it('starts empty in the lobby', () => {
    const game = createGame(1)
    expect(game.status).toBe('lobby')
    expect(game.players).toEqual([])
  })

  it('seats players in join order', () => {
    expect(lobby(3).players.map((p) => p.id)).toEqual(['p0', 'p1', 'p2'])
  })

  it('rejects a duplicate name, ignoring case', () => {
    const game = unwrap(addPlayer(createGame(1), 'a', 'Ann'))
    const result = addPlayer(game, 'b', 'ann')
    expect(result.ok ? null : result.error.code).toBe('NAME_TAKEN')
  })

  it('rejects a duplicate player id', () => {
    const game = unwrap(addPlayer(createGame(1), 'a', 'Ann'))
    const result = addPlayer(game, 'a', 'Bea')
    expect(result.ok ? null : result.error.code).toBe('DUPLICATE_PLAYER')
  })

  it('seats at most 8 players', () => {
    const result = addPlayer(lobby(8), 'p8', 'Player 8')
    expect(result.ok ? null : result.error.code).toBe('TABLE_FULL')
  })

  it('rejects joining after the game starts', () => {
    const game = unwrap(startGame(lobby(2)))
    const result = addPlayer(game, 'late', 'Late')
    expect(result.ok ? null : result.error.code).toBe('NOT_IN_LOBBY')
  })

  it('needs at least two players to start', () => {
    const result = startGame(lobby(1))
    expect(result.ok ? null : result.error.code).toBe('NOT_ENOUGH_PLAYERS')
  })

  it('does not modify the game it was given', () => {
    const game = lobby(2)
    const before = JSON.stringify(game)
    startGame(game)
    expect(JSON.stringify(game)).toBe(before)
  })
})

describe('dealing', () => {
  it.each([
    [2, 108, 15],
    [3, 108, 13],
    [4, 108, 13],
    [5, 162, 13],
    [6, 162, 13],
    [7, 216, 13],
    [8, 216, 13],
  ])('%i players: %i cards total, %i-card hands, no red 3s in hand', (n, total, size) => {
    const game = unwrap(startGame(lobby(n)))
    expect(countCards(game)).toBe(total)
    for (const player of game.players) {
      expect(player.hand).toHaveLength(size)
      expect(player.hand.some(isRed3)).toBe(false)
    }
  })

  it('never starts the discard pile with a red 3 or a wild', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const game = unwrap(startGame(lobby(4, seed)))
      const [upcard] = game.round!.discard
      expect(game.round!.discard).toHaveLength(1)
      expect(isRed3(upcard) || isWild(upcard)).toBe(false)
    }
  })

  it('lets the player left of the dealer go first', () => {
    const game = unwrap(startGame(lobby(3)))
    expect(game.status).toBe('playing')
    expect(game.round!.dealer).toBe(0)
    expect(game.round!.current).toBe(1)
    expect(game.round!.phase).toBe('draw')
    expect(game.players.map((p) => p.turnsThisRound)).toEqual([0, 1, 0])
  })

  it('deals the same cards for the same seed and different cards for another', () => {
    const a = unwrap(startGame(lobby(3, 9)))
    const b = unwrap(startGame(lobby(3, 9)))
    const c = unwrap(startGame(lobby(3, 10)))
    expect(a.players[0].hand).toEqual(b.players[0].hand)
    expect(a.players[0].hand).not.toEqual(c.players[0].hand)
  })
})

describe('startNextRound', () => {
  it('rejects while a round is in progress', () => {
    const result = startNextRound(unwrap(startGame(lobby(2))))
    expect(result.ok ? null : result.error.code).toBe('ROUND_NOT_OVER')
  })

  it('rotates the dealer, deals fresh hands, and keeps scores', () => {
    const finished = makeGame({
      players: [makePlayer({ id: 'a', score: 100 }), makePlayer({ id: 'b', score: -50 })],
    })
    finished.status = 'roundOver'
    const next = unwrap(startNextRound(finished))
    expect(next.status).toBe('playing')
    expect(next.round!.number).toBe(2)
    expect(next.round!.dealer).toBe(1)
    expect(next.round!.current).toBe(0)
    expect(next.players.map((p) => p.score)).toEqual([100, -50])
    expect(next.players.every((p) => p.hand.length === 15 && p.melds.length === 0)).toBe(true)
    expect(countCards(next)).toBe(108)
  })
})
