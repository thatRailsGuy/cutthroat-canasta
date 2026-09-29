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
  for (const name of names) state = handleMessage(state, null, { type: 'join', name }, ids).state
  return { state, ids }
}

function started(): { state: RoomState; ids: RoomIds } {
  const { state, ids } = roomWith(['Ann', 'Bob'])
  return { state: handleMessage(state, 'p1', { type: 'start' }, ids).state, ids }
}

const errorOf = (outcome: { reply: unknown[] }) => outcome.reply[0]

describe('join', () => {
  it('seats the first player as host and replies with their token', () => {
    const outcome = handleMessage(
      createRoom('ABCDEF', SEED),
      null,
      { type: 'join', name: 'Ann' },
      sequentialIds(),
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
    const outcome = handleMessage(state, null, { type: 'join', name: 'ann' }, ids)
    expect(outcome.changed).toBe(false)
    expect(outcome.broadcast).toBe(false)
    expect(errorOf(outcome)).toMatchObject({ type: 'error', code: 'NAME_TAKEN' })
  })

  it('rejects a second join on the same connection', () => {
    const { state, ids } = roomWith(['Ann'])
    const outcome = handleMessage(state, 'p1', { type: 'join', name: 'Other' }, ids)
    expect(errorOf(outcome)).toMatchObject({ type: 'error', code: 'ALREADY_JOINED' })
  })

  it('reattaches a known token without changing state, even after the start', () => {
    const { state, ids } = started()
    const outcome = handleMessage(state, null, { type: 'join', name: 'Ann', token: 't1' }, ids)
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

  it('treats an unknown token as a new player in the lobby', () => {
    const { state, ids } = roomWith(['Ann'])
    const outcome = handleMessage(state, null, { type: 'join', name: 'Bob', token: 'nope' }, ids)
    expect(outcome.bindPlayerId).toBe('p2')
    expect(outcome.reply[0]).toMatchObject({ type: 'joined', playerId: 'p2', token: 't2' })
  })

  it.each(['__proto__', 'constructor', 'toString'])(
    'does not treat inherited object keys as tokens (%s)',
    (token) => {
      const { state, ids } = roomWith(['Ann'])
      const outcome = handleMessage(state, null, { type: 'join', name: 'Bob', token }, ids)
      expect(outcome.bindPlayerId).toBe('p2')
      expect(outcome.state.game.players).toHaveLength(2)
    },
  )

  it('rejects new players once the game has started', () => {
    const { state, ids } = started()
    const outcome = handleMessage(state, null, { type: 'join', name: 'Cat' }, ids)
    expect(errorOf(outcome)).toMatchObject({ type: 'error', code: 'NOT_IN_LOBBY' })
  })
})

describe('host controls', () => {
  it('lets only the host start the game', () => {
    const { state, ids } = roomWith(['Ann', 'Bob'])
    expect(errorOf(handleMessage(state, null, { type: 'start' }, ids))).toMatchObject({
      code: 'NOT_JOINED',
    })
    expect(errorOf(handleMessage(state, 'p2', { type: 'start' }, ids))).toMatchObject({
      code: 'NOT_HOST',
    })
    const outcome = handleMessage(state, 'p1', { type: 'start' }, ids)
    expect(outcome.changed).toBe(true)
    expect(outcome.broadcast).toBe(true)
    expect(outcome.reply).toEqual([])
    expect(outcome.state.game.status).toBe('playing')
  })

  it('passes engine errors through, such as starting alone', () => {
    const { state, ids } = roomWith(['Ann'])
    expect(errorOf(handleMessage(state, 'p1', { type: 'start' }, ids))).toMatchObject({
      code: 'NOT_ENOUGH_PLAYERS',
    })
  })

  it('lets only the host start the next round', () => {
    const { state, ids } = started()
    expect(errorOf(handleMessage(state, 'p2', { type: 'nextRound' }, ids))).toMatchObject({
      code: 'NOT_HOST',
    })
    expect(errorOf(handleMessage(state, 'p1', { type: 'nextRound' }, ids))).toMatchObject({
      code: 'ROUND_NOT_OVER',
    })
  })
})

describe('actions', () => {
  const draw: ClientMessage = { type: 'action', action: { type: 'drawStock' } }

  it('applies an action for the player whose turn it is', () => {
    const { state, ids } = started()
    // Ann (p1) dealt, so Bob (p2, seat 1) goes first.
    const outcome = handleMessage(state, 'p2', draw, ids)
    expect(outcome.changed).toBe(true)
    expect(outcome.broadcast).toBe(true)
    expect(outcome.state.game.round?.phase).toBe('play')
  })

  it('returns rule errors to the sender and leaves state untouched', () => {
    const { state, ids } = started()
    const outcome = handleMessage(state, 'p1', draw, ids)
    expect(outcome.changed).toBe(false)
    expect(outcome.broadcast).toBe(false)
    expect(outcome.state).toBe(state)
    expect(errorOf(outcome)).toMatchObject({ type: 'error', code: 'NOT_YOUR_TURN' })
  })

  it('requires joining first', () => {
    const { state, ids } = started()
    expect(errorOf(handleMessage(state, null, draw, ids))).toMatchObject({ code: 'NOT_JOINED' })
  })

  it('never mutates the state it was given', () => {
    const { state, ids } = started()
    const before = JSON.stringify(state)
    handleMessage(state, 'p2', draw, ids)
    handleMessage(state, null, { type: 'join', name: 'Ann', token: 't1' }, ids)
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
