import { describe, expect, it } from 'vitest'
import {
  addPlayer,
  createGame,
  quitGame,
  removePlayer,
  restartGame,
  startGame,
  redealRound,
  startNextRound,
} from '../src/game'
import { isRed3, isWild } from '../src/cards'
import type { Game } from '../src/types'
import { countCards, lobby, makeGame, makePlayer, seedOf, unwrap } from './fixtures'

describe('lobby', () => {
  it('starts empty in the lobby', () => {
    const game = createGame(seedOf(1))
    expect(game.status).toBe('lobby')
    expect(game.players).toEqual([])
  })

  it('seats players in join order', () => {
    expect(lobby(3).players.map((p) => p.id)).toEqual(['p0', 'p1', 'p2'])
  })

  it('rejects a duplicate name, ignoring case', () => {
    const game = unwrap(addPlayer(createGame(seedOf(1)), 'a', 'Ann'))
    const result = addPlayer(game, 'b', 'ann')
    expect(result.ok ? null : result.error.code).toBe('NAME_TAKEN')
  })

  it('rejects a duplicate player id', () => {
    const game = unwrap(addPlayer(createGame(seedOf(1)), 'a', 'Ann'))
    const result = addPlayer(game, 'a', 'Bea')
    expect(result.ok ? null : result.error.code).toBe('DUPLICATE_PLAYER')
  })

  it('seats at most 8 players', () => {
    const result = addPlayer(lobby(8), 'p8', 'Player 8')
    expect(result.ok ? null : result.error.code).toBe('TABLE_FULL')
  })

  it('seats a late joiner at the next hand, after everyone already playing', () => {
    const game = unwrap(startGame(lobby(2)))
    const joined = unwrap(addPlayer(game, 'late', 'Late'))
    expect(joined.players.map((p) => p.id)).toEqual(['p0', 'p1'])
    expect(joined.waiting!.map((p) => p.id)).toEqual(['late'])
    expect(joined.round!.feed.at(-1)).toEqual({ type: 'joined', playerId: 'late', name: 'Late' })

    const next = unwrap(startNextRound({ ...joined, status: 'roundOver' }))
    expect(next.players.map((p) => p.id)).toEqual(['p0', 'p1', 'late'])
    expect(next.waiting).toEqual([])
    expect(next.players[2].hand.length).toBe(next.players[0].hand.length)
    expect(next.players[2].score).toBe(0)
  })

  it('deals a waiting player in at a new hand of the same round', () => {
    const joined = unwrap(addPlayer(unwrap(startGame(lobby(2))), 'late', 'Late'))
    const redealt = unwrap(redealRound(joined, 'p0'))
    expect(redealt.players.map((p) => p.id)).toEqual(['p0', 'p1', 'late'])
  })

  it('counts waiting players toward the table limit and their names', () => {
    const joined = unwrap(addPlayer(unwrap(startGame(lobby(7))), 'late', 'Late'))
    const full = addPlayer(joined, 'later', 'Later')
    expect(full.ok ? null : full.error.code).toBe('TABLE_FULL')
    const taken = addPlayer(unwrap(addPlayer(unwrap(startGame(lobby(2))), 'a', 'Ann')), 'b', 'ann')
    expect(taken.ok ? null : taken.error.code).toBe('NAME_TAKEN')
  })

  it('lets a waiting player leave before they are dealt in', () => {
    const joined = unwrap(addPlayer(unwrap(startGame(lobby(2))), 'late', 'Late'))
    const left = unwrap(quitGame(joined, 'late'))
    expect(left.waiting).toEqual([])
    expect(left.players).toHaveLength(2)
    expect(left.quit).toEqual([])
  })

  it('rejects joining a finished game', () => {
    const game = unwrap(startGame(lobby(2)))
    const result = addPlayer({ ...game, status: 'gameOver' }, 'late', 'Late')
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
    [2, 108, 13],
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

  it('keeps a red 3 or wild upcard in the pile, where it freezes the pile for everyone', () => {
    let freezes = 0
    for (let seed = 1; seed <= 50; seed++) {
      const round = unwrap(startGame(lobby(4, seed))).round!
      const [upcard] = round.discard
      expect(round.discard).toHaveLength(1)
      const freezing = isRed3(upcard) || isWild(upcard)
      expect(round.pileFrozenForAll).toBe(freezing)
      expect(round.frozenBy).toEqual(freezing ? upcard : null)
      if (freezing) freezes++
    }
    expect(freezes).toBeGreaterThan(0)
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

  it('deals a different shuffle each round of the same game', () => {
    const round1 = unwrap(startGame(lobby(3, 9)))
    const round2 = unwrap(startNextRound({ ...round1, status: 'roundOver' }))
    expect(round2.players[0].hand).not.toEqual(round1.players[0].hand)
  })

  it('starts each round with an empty feed', () => {
    const game = unwrap(startGame(lobby(2)))
    game.round!.feed.push({ type: 'stockOut' })
    const next = unwrap(startNextRound({ ...game, status: 'roundOver' }))
    expect(next.round!.feed).toEqual([])
  })
})

describe('redealRound', () => {
  it('throws out the hand and deals the same round again with a new shuffle', () => {
    const game = unwrap(startGame(lobby(3, 9)))
    game.round!.feed.push({ type: 'stockOut' })
    const next = unwrap(redealRound(game, 'p0'))
    expect(next.status).toBe('playing')
    expect(next.round!.number).toBe(1)
    expect(next.round!.dealer).toBe(0)
    expect(next.round!.current).toBe(1)
    expect(next.round!.redeals).toBe(1)
    expect(next.round!.feed).toEqual([{ type: 'redealt', playerId: 'p0' }])
    expect(next.players[0].hand).not.toEqual(game.players[0].hand)
    expect(next.history).toEqual([])
    expect(countCards(next)).toBe(countCards(game))
  })

  it('deals a different shuffle each time', () => {
    const once = unwrap(redealRound(unwrap(startGame(lobby(3, 9))), 'p0'))
    const twice = unwrap(redealRound(once, 'p0'))
    expect(twice.round!.redeals).toBe(2)
    expect(twice.players[0].hand).not.toEqual(once.players[0].hand)
  })

  it('only works while a round is being played', () => {
    const game = unwrap(startGame(lobby(2)))
    const result = redealRound({ ...game, status: 'roundOver' }, 'p0')
    expect(result.ok ? null : result.error.code).toBe('GAME_NOT_PLAYING')
  })
})

describe('removePlayer', () => {
  it('removes the seat and keeps the others in order', () => {
    const game = unwrap(removePlayer(lobby(3), 'p1'))
    expect(game.players.map((p) => p.id)).toEqual(['p0', 'p2'])
  })

  it('does not modify the game it was given', () => {
    const game = lobby(3)
    unwrap(removePlayer(game, 'p1'))
    expect(game.players).toHaveLength(3)
  })

  it('frees the name for someone else', () => {
    const game = unwrap(removePlayer(lobby(2), 'p1'))
    expect(addPlayer(game, 'new', 'Player 1').ok).toBe(true)
  })

  it('rejects once the game has started', () => {
    const result = removePlayer(unwrap(startGame(lobby(2))), 'p1')
    expect(result.ok ? null : result.error.code).toBe('NOT_IN_LOBBY')
  })

  it('throws for an unknown player', () => {
    expect(() => removePlayer(lobby(2), 'stranger')).toThrow('Unknown player')
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
    expect(next.players.every((p) => p.hand.length === 13 && p.melds.length === 0)).toBe(true)
    expect(countCards(next)).toBe(108)
  })
})

describe('quitGame', () => {
  const started = (players: number) => unwrap(startGame(lobby(players)))

  it('refuses in the lobby', () => {
    const result = quitGame(lobby(2), 'p0')
    expect(result.ok ? null : result.error.code).toBe('GAME_NOT_PLAYING')
  })

  it('throws for a player who is not seated', () => {
    expect(() => quitGame(started(3), 'stranger')).toThrow('Unknown player')
  })

  it('takes the player, their hand and their melds out of play, and records it', () => {
    const game = started(3)
    const next = unwrap(quitGame(game, 'p2'))
    expect(next.players.map((p) => p.id)).toEqual(['p0', 'p1'])
    expect(next.quit).toEqual([{ id: 'p2', name: 'Player 2', score: 0, round: 1 }])
    expect(next.round!.feed.at(-1)).toEqual({ type: 'quit', playerId: 'p2', name: 'Player 2' })
    expect(next.log.at(-1)).toEqual({ event: 'quit', playerId: 'p2' })
    expect(next.status).toBe('playing')
  })

  it('passes the turn to the next player, who starts at the draw', () => {
    // Dealer p0, so p1 is playing.
    const game = started(3)
    game.round!.phase = 'play'
    const next = unwrap(quitGame(game, 'p1'))
    expect(next.players[next.round!.current].id).toBe('p2')
    expect(next.round!.phase).toBe('draw')
    expect(next.players[next.round!.current].turnsThisRound).toBe(1)
  })

  it('wraps the turn to the first seat when the last seat quits on their turn', () => {
    const game = started(3)
    game.round!.current = 2
    const next = unwrap(quitGame(game, 'p2'))
    expect(next.players[next.round!.current].id).toBe('p0')
  })

  it('keeps the same player on turn when an earlier seat quits', () => {
    const game = started(4)
    game.round!.current = 2
    const next = unwrap(quitGame(game, 'p0'))
    expect(next.players[next.round!.current].id).toBe('p2')
  })

  it('passes the deal to the seat after a quitting dealer', () => {
    // Dealer p0 quits: p1 should deal next round, as if p0 had dealt this one.
    const game = started(3)
    const next = unwrap(quitGame(game, 'p0'))
    const nextDealer = (next.round!.dealer + 1) % next.players.length
    expect(next.players[nextDealer].id).toBe('p1')
  })

  it('can quit between rounds, and the next round deals to the players left', () => {
    const game = started(3)
    game.status = 'roundOver'
    const next = unwrap(startNextRound(unwrap(quitGame(game, 'p1'))))
    expect(next.players.map((p) => p.id)).toEqual(['p0', 'p2'])
    expect(next.players.every((p) => p.hand.length === 13)).toBe(true)
  })

  it('ends the game when only one player is left, and that player wins', () => {
    const next = unwrap(quitGame(started(2), 'p0'))
    expect(next.status).toBe('gameOver')
    expect(next.winners).toEqual(['p1'])
  })

  it('refuses once the game is over', () => {
    const over = unwrap(quitGame(started(2), 'p0'))
    const result = quitGame(over, 'p1')
    expect(result.ok ? null : result.error.code).toBe('GAME_NOT_PLAYING')
  })
})

describe('restartGame', () => {
  /** Three players at game over, after a round that p1 dealt. p3 waits for a seat. */
  function finished(): Game {
    const game = unwrap(addPlayer(unwrap(startGame(lobby(3))), 'p3', 'Player 3'))
    game.round!.dealer = 1
    game.status = 'gameOver'
    game.players[0].score = 5120
    game.winners = ['p0']
    game.history = [{ round: 1, endedBy: 'goingOut', wentOut: 'p0', breakdown: {}, hands: {} }]
    game.quit = [{ id: 'gone', name: 'Gone', score: 40, round: 1 }]
    return game
  }

  it('refuses before the game is over', () => {
    const result = restartGame(unwrap(startGame(lobby(2))), seedOf(9))
    expect(result.ok ? null : result.error.code).toBe('GAME_NOT_OVER')
  })

  it('goes back to the lobby with the same players, and everything else starts over', () => {
    const next = unwrap(restartGame(finished(), seedOf(9)))
    expect(next.status).toBe('lobby')
    expect(next.round).toBeNull()
    expect(next.players.map((p) => p.id)).toEqual(['p0', 'p1', 'p2', 'p3'])
    expect(next.waiting).toEqual([])
    expect(next.players.map((p) => [p.score, p.hand.length, p.melds.length])).toEqual([
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ])
    expect(next).toMatchObject({ history: [], winners: [], quit: [], seed: seedOf(9), number: 2 })
    expect(next.log.at(-1)).toEqual({ event: 'restart' })
  })

  it('counts the games at the table', () => {
    const second = unwrap(restartGame(finished(), seedOf(9)))
    const third = unwrap(restartGame({ ...second, status: 'gameOver' }, seedOf(10)))
    expect(third.number).toBe(3)
  })

  it('has the player after the last dealer deal first', () => {
    const next = unwrap(startGame(unwrap(restartGame(finished(), seedOf(9)))))
    expect(next.round!.dealer).toBe(2)
    expect(next.players[next.round!.current].id).toBe('p3')
  })

  it('lets the first seat deal if that player has left the lobby', () => {
    const lobbyAgain = unwrap(removePlayer(unwrap(restartGame(finished(), seedOf(9))), 'p2'))
    expect(unwrap(startGame(lobbyAgain)).round!.dealer).toBe(0)
  })

  it('deals new hands with the new seed', () => {
    // The same four players in a first game with the old seed.
    const game = finished()
    const before = unwrap(startGame(lobby(4))).players[0].hand.map((c) => c.id)
    const after = unwrap(startGame(unwrap(restartGame(game, seedOf(9))))).players[0].hand
    expect(after.map((c) => c.id)).not.toEqual(before)
  })
})
