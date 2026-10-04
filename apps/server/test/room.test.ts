import { describe, expect, it } from 'vitest'
import type { Seed } from '@canasta/engine'
import type { ClientMessage } from '../src/protocol'
import { createRoom, handleMessage, stateMessage, type RoomIds, type RoomState } from '../src/room'

const SEED: Seed = [42, 0, 0, 0]

function sequentialIds(): RoomIds {
  let players = 0
  let tokens = 0
  return { newPlayerId: () => `p${++players}`, newToken: () => `t${++tokens}` }
}

function roomWith(names: string[]): { state: RoomState; ids: RoomIds } {
  const ids = sequentialIds()
  let state = createRoom('ABCDEF', SEED)
  for (const name of names)
    state = handleMessage(state, null, { type: 'join', name }, ids, []).state
  return { state, ids }
}

function started(): { state: RoomState; ids: RoomIds } {
  const { state, ids } = roomWith(['Ann', 'Bob'])
  return { state: handleMessage(state, 'p1', { type: 'start' }, ids, []).state, ids }
}

const errorOf = (outcome: { reply: unknown[] }) => outcome.reply[0]

describe('join', () => {
  it('seats the first player as host and replies with their token', () => {
    const outcome = handleMessage(
      createRoom('ABCDEF', SEED),
      null,
      { type: 'join', name: 'Ann' },
      sequentialIds(),
      [],
    )
    expect(outcome.changed).toBe(true)
    expect(outcome.broadcast).toBe(true)
    expect(outcome.bindPlayerId).toBe('p1')
    expect(outcome.reply).toEqual([{ type: 'joined', code: 'ABCDEF', playerId: 'p1', token: 't1' }])
    expect(outcome.state.hostId).toBe('p1')
    expect(outcome.state.tokens).toEqual({ t1: 'p1' })
    expect(outcome.state.game.players.map((p) => p.name)).toEqual(['Ann'])
  })

  it('keeps the first player as host when others join', () => {
    const { state } = roomWith(['Ann', 'Bob'])
    expect(state.hostId).toBe('p1')
    expect(state.game.players.map((p) => p.id)).toEqual(['p1', 'p2'])
  })

  it('returns engine errors such as a duplicate name', () => {
    const { state, ids } = roomWith(['Ann'])
    const outcome = handleMessage(state, null, { type: 'join', name: 'ann' }, ids, [])
    expect(outcome.changed).toBe(false)
    expect(outcome.broadcast).toBe(false)
    expect(errorOf(outcome)).toMatchObject({ type: 'error', code: 'NAME_TAKEN' })
  })

  it('rejects a second join on the same connection', () => {
    const { state, ids } = roomWith(['Ann'])
    const outcome = handleMessage(state, 'p1', { type: 'join', name: 'Other' }, ids, [])
    expect(errorOf(outcome)).toMatchObject({ type: 'error', code: 'ALREADY_JOINED' })
  })

  it('reattaches a known token without changing state, even after the start', () => {
    const { state, ids } = started()
    const outcome = handleMessage(state, null, { type: 'join', name: 'Ann', token: 't1' }, ids, [])
    expect(outcome.changed).toBe(false)
    expect(outcome.broadcast).toBe(true)
    expect(outcome.state).toBe(state)
    expect(outcome.bindPlayerId).toBe('p1')
    expect(outcome.reply).toEqual([
      {
        type: 'joined',
        code: 'ABCDEF',
        playerId: 'p1',
        token: 't1',
      },
    ])
  })

  it('rejects an unknown token in the lobby instead of adding a second seat', () => {
    const { state, ids } = roomWith(['Ann'])
    const outcome = handleMessage(
      state,
      null,
      { type: 'join', name: 'Bob', token: 'nope' },
      ids,
      [],
    )
    expect(errorOf(outcome)).toEqual({
      type: 'error',
      code: 'UNKNOWN_TOKEN',
      message: 'That seat link is no longer valid. Join again with your name.',
    })
    expect(outcome.bindPlayerId).toBeUndefined()
    expect(outcome.changed).toBe(false)
  })

  it('rejects an unknown token once the game has started', () => {
    const { state, ids } = started()
    const outcome = handleMessage(
      state,
      null,
      { type: 'join', name: 'Cat', token: 'nope' },
      ids,
      [],
    )
    expect(errorOf(outcome)).toEqual({
      type: 'error',
      code: 'UNKNOWN_TOKEN',
      message: 'That seat link is no longer valid. Ask the host for a new rejoin link.',
    })
  })

  it.each(['__proto__', 'constructor', 'toString'])(
    'does not treat inherited object keys as tokens (%s)',
    (token) => {
      const { state, ids } = roomWith(['Ann'])
      const outcome = handleMessage(state, null, { type: 'join', name: 'Bob', token }, ids, [])
      expect(errorOf(outcome)).toMatchObject({ type: 'error', code: 'UNKNOWN_TOKEN' })
      expect(outcome.state.game.players).toHaveLength(1)
    },
  )

  it('lets a new player join a started game to wait for the next hand', () => {
    const { state, ids } = started()
    const outcome = handleMessage(state, null, { type: 'join', name: 'Cat' }, ids, [])
    expect(outcome).toMatchObject({ changed: true, bindPlayerId: 'p3' })
    expect(outcome.state.game.waiting?.map((p) => p.name)).toEqual(['Cat'])

    // Waiting still counts as seated: they can quit before being dealt in.
    const quit = handleMessage(outcome.state, 'p3', { type: 'leave' }, ids, [])
    expect(quit).toMatchObject({ announce: { type: 'playerQuit', playerId: 'p3', name: 'Cat' } })
    expect(quit.state.game.waiting).toEqual([])
  })
})

describe('host controls', () => {
  it('lets only the host start the game', () => {
    const { state, ids } = roomWith(['Ann', 'Bob'])
    expect(errorOf(handleMessage(state, null, { type: 'start' }, ids, []))).toMatchObject({
      code: 'NOT_JOINED',
    })
    expect(errorOf(handleMessage(state, 'p2', { type: 'start' }, ids, []))).toMatchObject({
      code: 'NOT_HOST',
    })
    const outcome = handleMessage(state, 'p1', { type: 'start' }, ids, [])
    expect(outcome.changed).toBe(true)
    expect(outcome.broadcast).toBe(true)
    expect(outcome.reply).toEqual([])
    expect(outcome.state.game.status).toBe('playing')
  })

  it('passes engine errors through, such as starting alone', () => {
    const { state, ids } = roomWith(['Ann'])
    expect(errorOf(handleMessage(state, 'p1', { type: 'start' }, ids, []))).toMatchObject({
      code: 'NOT_ENOUGH_PLAYERS',
    })
  })

  it('lets any seated player start the next round', () => {
    const { state, ids } = started()
    const roundOver: RoomState = { ...state, game: { ...state.game, status: 'roundOver' } }
    expect(errorOf(handleMessage(roundOver, null, { type: 'nextRound' }, ids, []))).toMatchObject({
      code: 'NOT_JOINED',
    })
    const outcome = handleMessage(roundOver, 'p2', { type: 'nextRound' }, ids, [])
    expect(outcome.changed).toBe(true)
    expect(outcome.state.game.round?.number).toBe(2)
  })

  it('rejects the next round while one is in progress', () => {
    const { state, ids } = started()
    expect(errorOf(handleMessage(state, 'p2', { type: 'nextRound' }, ids, []))).toMatchObject({
      code: 'ROUND_NOT_OVER',
    })
  })
})

describe('redeal', () => {
  it('lets only the host deal a new hand', () => {
    const { state, ids } = started()
    expect(errorOf(handleMessage(state, 'p2', { type: 'redeal' }, ids, []))).toMatchObject({
      code: 'NOT_HOST',
    })
    const outcome = handleMessage(state, 'p1', { type: 'redeal' }, ids, [])
    expect(outcome).toMatchObject({ changed: true, broadcast: true })
    expect(outcome.state.game.round).toMatchObject({ number: 1, redeals: 1 })
  })

  it('rejects a new hand between rounds', () => {
    const { state, ids } = started()
    const roundOver: RoomState = { ...state, game: { ...state.game, status: 'roundOver' } }
    expect(errorOf(handleMessage(roundOver, 'p1', { type: 'redeal' }, ids, []))).toMatchObject({
      code: 'GAME_NOT_PLAYING',
    })
  })
})

describe('leave', () => {
  it('frees the seat, revokes its token, and detaches the sender', () => {
    const { state, ids } = roomWith(['Ann', 'Bob'])
    const outcome = handleMessage(state, 'p2', { type: 'leave' }, ids, [])
    expect(outcome).toMatchObject({
      changed: true,
      broadcast: true,
      reply: [],
      detach: { playerId: 'p2', reason: 'left' },
    })
    expect(outcome.state.game.players.map((p) => p.id)).toEqual(['p1'])
    expect(outcome.state.tokens).toEqual({ t1: 'p1' })
    expect(outcome.state.hostId).toBe('p1')
  })

  it('hands the host role to the next seat when the host leaves', () => {
    const { state, ids } = roomWith(['Ann', 'Bob', 'Cat'])
    expect(handleMessage(state, 'p1', { type: 'leave' }, ids, []).state.hostId).toBe('p2')
  })

  it('leaves no host when the last player leaves, and the next to join becomes host', () => {
    const { state, ids } = roomWith(['Ann'])
    const empty = handleMessage(state, 'p1', { type: 'leave' }, ids, []).state
    expect(empty.hostId).toBeNull()
    expect(handleMessage(empty, null, { type: 'join', name: 'Bob' }, ids, []).state.hostId).toBe(
      'p2',
    )
  })

  it('quits a started game: the others play on and are told who quit', () => {
    const { state, ids } = roomWith(['Ann', 'Bob', 'Cat'])
    const game = handleMessage(state, 'p1', { type: 'start' }, ids, []).state
    const outcome = handleMessage(game, 'p2', { type: 'leave' }, ids, [])
    expect(outcome.changed).toBe(true)
    expect(outcome.broadcast).toBe(true)
    expect(outcome.detach).toEqual({ playerId: 'p2', reason: 'quit' })
    expect(outcome.announce).toEqual({ type: 'playerQuit', playerId: 'p2', name: 'Bob' })
    expect(outcome.state.game.players.map((p) => p.id)).toEqual(['p1', 'p3'])
    expect(outcome.state.game.status).toBe('playing')
    expect(Object.values(outcome.state.tokens)).toEqual(['p1', 'p3'])
    expect(outcome.state.hostId).toBe('p1')
  })

  it('makes the next seat host at once when the host quits', () => {
    const { state, ids } = roomWith(['Ann', 'Bob', 'Cat'])
    const game = handleMessage(state, 'p1', { type: 'start' }, ids, []).state
    expect(handleMessage(game, 'p1', { type: 'leave' }, ids, []).state.hostId).toBe('p2')
  })

  it('ends a two-player game when one quits', () => {
    const { state, ids } = started()
    const outcome = handleMessage(state, 'p2', { type: 'leave' }, ids, [])
    expect(outcome.state.game.status).toBe('gameOver')
    expect(outcome.state.game.winners).toEqual(['p1'])
  })

  it('requires joining first', () => {
    const { state, ids } = roomWith(['Ann'])
    expect(errorOf(handleMessage(state, null, { type: 'leave' }, ids, []))).toMatchObject({
      code: 'NOT_JOINED',
    })
  })
})

describe('kick', () => {
  it('lets the host remove another player and detach them', () => {
    const { state, ids } = roomWith(['Ann', 'Bob'])
    const outcome = handleMessage(state, 'p1', { type: 'kick', playerId: 'p2' }, ids, [])
    expect(outcome.detach).toEqual({ playerId: 'p2', reason: 'kicked' })
    expect(outcome.state.game.players.map((p) => p.id)).toEqual(['p1'])
    expect(outcome.state.tokens).toEqual({ t1: 'p1' })
  })

  it('is host only', () => {
    const { state, ids } = roomWith(['Ann', 'Bob'])
    expect(
      errorOf(handleMessage(state, 'p2', { type: 'kick', playerId: 'p1' }, ids, [])),
    ).toMatchObject({ code: 'NOT_HOST' })
  })

  it('rejects someone not at the table', () => {
    const { state, ids } = roomWith(['Ann', 'Bob'])
    expect(
      errorOf(handleMessage(state, 'p1', { type: 'kick', playerId: 'nobody' }, ids, [])),
    ).toMatchObject({ code: 'NO_SUCH_PLAYER' })
  })

  it('is refused once the game has started', () => {
    const { state, ids } = started()
    expect(
      errorOf(handleMessage(state, 'p1', { type: 'kick', playerId: 'p2' }, ids, [])),
    ).toMatchObject({ code: 'NOT_IN_LOBBY' })
  })
})

describe('reissue', () => {
  it('replaces the tokens of a disconnected seat and replies only to the host', () => {
    const { state, ids } = started()
    const outcome = handleMessage(state, 'p1', { type: 'reissue', playerId: 'p2' }, ids, ['p1'])
    expect(outcome).toMatchObject({
      changed: true,
      broadcast: false,
      reply: [{ type: 'reissued', playerId: 'p2', token: 't3' }],
      announce: { type: 'seatReissued', playerId: 'p2' },
    })
    expect(outcome.state.tokens).toEqual({ t1: 'p1', t3: 'p2' })
    const rejoin = handleMessage(
      outcome.state,
      null,
      { type: 'join', name: 'Bob', token: 't3' },
      ids,
      [],
    )
    expect(rejoin.bindPlayerId).toBe('p2')
  })

  it('refuses a connected player', () => {
    const { state, ids } = started()
    expect(
      errorOf(handleMessage(state, 'p1', { type: 'reissue', playerId: 'p2' }, ids, ['p1', 'p2'])),
    ).toEqual({
      type: 'error',
      code: 'PLAYER_CONNECTED',
      message:
        "Bob is still connected, so they don't need a rejoin link. If they're stuck, try again in a minute.",
    })
  })

  it('is host only', () => {
    const { state, ids } = started()
    expect(
      errorOf(handleMessage(state, 'p2', { type: 'reissue', playerId: 'p1' }, ids, ['p2'])),
    ).toMatchObject({ code: 'NOT_HOST' })
  })

  it('rejects someone not at the table', () => {
    const { state, ids } = started()
    expect(
      errorOf(handleMessage(state, 'p1', { type: 'reissue', playerId: 'nobody' }, ids, ['p1'])),
    ).toMatchObject({ code: 'NO_SUCH_PLAYER' })
  })
})

describe('actions', () => {
  const draw: ClientMessage = { type: 'action', action: { type: 'drawStock' } }

  it('applies an action for the player whose turn it is', () => {
    const { state, ids } = started()
    // Ann (p1) dealt, so Bob (p2, seat 1) goes first.
    const outcome = handleMessage(state, 'p2', draw, ids, [])
    expect(outcome.changed).toBe(true)
    expect(outcome.broadcast).toBe(true)
    expect(outcome.state.game.round?.phase).toBe('play')
  })

  it('returns rule errors to the sender and leaves state untouched', () => {
    const { state, ids } = started()
    const outcome = handleMessage(state, 'p1', draw, ids, [])
    expect(outcome.changed).toBe(false)
    expect(outcome.broadcast).toBe(false)
    expect(outcome.state).toBe(state)
    expect(errorOf(outcome)).toMatchObject({ type: 'error', code: 'NOT_YOUR_TURN' })
  })

  it('requires joining first', () => {
    const { state, ids } = started()
    expect(errorOf(handleMessage(state, null, draw, ids, []))).toMatchObject({ code: 'NOT_JOINED' })
  })

  it('never mutates the state it was given', () => {
    const { state, ids } = started()
    const before = JSON.stringify(state)
    handleMessage(state, 'p2', draw, ids, [])
    handleMessage(state, null, { type: 'join', name: 'Ann', token: 't1' }, ids, [])
    expect(JSON.stringify(state)).toBe(before)
  })
})

describe('stateMessage', () => {
  it("sends the player's own view, the host id, and who's connected", () => {
    const { state } = started()
    const message = stateMessage(state, 'p2', ['p1', 'p2'])
    expect(message).toMatchObject({ type: 'state', hostId: 'p1', connected: ['p1', 'p2'] })
    if (message.type !== 'state') throw new Error('expected a state message')
    expect(message.view.you?.id).toBe('p2')
    expect(message.view.players[0]).not.toHaveProperty('hand')
  })
})
