import { describe, expect, it } from 'vitest'
import type { Seed } from '@canasta/engine'
import type { ClientMessage } from '../src/protocol'
import {
  blockedAddresses,
  createRoom,
  handleMessage,
  stateMessage,
  type RoomIds,
  type RoomState,
} from '../src/room'

const SEED: Seed = [42, 0, 0, 0]

function sequentialIds(): RoomIds {
  let players = 0
  let tokens = 0
  return {
    newPlayerId: () => `p${++players}`,
    newToken: () => `t${++tokens}`,
    newSeed: () => [7, 7, 7, 7],
  }
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

  it('frees the seat for good at game over, but keeps the final standings', () => {
    const { state, ids } = roomWith(['Ann', 'Bob', 'Cat'])
    const game = handleMessage(state, 'p1', { type: 'start' }, ids, []).state
    const over = { ...game, game: { ...game.game, status: 'gameOver' as const } }
    const outcome = handleMessage(over, 'p2', { type: 'leave' }, ids, [])
    expect(outcome).toMatchObject({
      changed: true,
      broadcast: true,
      reply: [],
      detach: { playerId: 'p2', reason: 'left' },
    })
    expect(outcome.announce).toBeUndefined()
    expect(outcome.state.game.players.map((p) => p.id)).toEqual(['p1', 'p2', 'p3'])
    expect(outcome.state.game.left).toEqual(['p2'])
    expect(Object.values(outcome.state.tokens)).toEqual(['p1', 'p3'])
    expect(outcome.state.hostId).toBe('p1')

    const again = handleMessage(outcome.state, 'p1', { type: 'playAgain' }, ids, ['p1', 'p3'])
    expect(again.state.game.players.map((p) => p.id)).toEqual(['p1', 'p3'])
  })

  it('makes the next seat still here host when the host leaves at game over', () => {
    const { state, ids } = roomWith(['Ann', 'Bob', 'Cat'])
    const game = handleMessage(state, 'p1', { type: 'start' }, ids, []).state
    const over = { ...game, game: { ...game.game, status: 'gameOver' as const, left: ['p2'] } }
    expect(handleMessage(over, 'p1', { type: 'leave' }, ids, []).state.hostId).toBe('p3')
  })

  it('leaves no host when the last player leaves a finished game', () => {
    const { state, ids } = started()
    const over = { ...state, game: { ...state.game, status: 'gameOver' as const, left: ['p2'] } }
    expect(handleMessage(over, 'p1', { type: 'leave' }, ids, []).state.hostId).toBeNull()
  })

  it('treats a player who left a finished game as gone', () => {
    const { state, ids } = started()
    const over = { ...state, game: { ...state.game, status: 'gameOver' as const, left: ['p2'] } }
    const outcome = handleMessage(over, 'p1', { type: 'reissue', playerId: 'p2' }, ids, ['p1'])
    expect(errorOf(outcome)).toMatchObject({ code: 'NO_SUCH_PLAYER' })
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

describe('playAgain', () => {
  /** Ann (host, p1) and Bob (p2) at game over. */
  function finished(): { state: RoomState; ids: RoomIds } {
    const { state, ids } = started()
    return { state: { ...state, game: { ...state.game, status: 'gameOver' } }, ids }
  }

  it('lets the host take the table back to the lobby with a new shuffle', () => {
    const { state, ids } = finished()
    const outcome = handleMessage(state, 'p1', { type: 'playAgain' }, ids, ['p1', 'p2'])
    expect(outcome).toMatchObject({ changed: true, broadcast: true, reply: [] })
    expect(outcome.state.game).toMatchObject({ status: 'lobby', number: 2, seed: [7, 7, 7, 7] })
    expect(outcome.state.hostId).toBe('p1')
    expect(outcome.state.tokens).toEqual(state.tokens)
  })

  it('refuses another player while the host is here', () => {
    const { state, ids } = finished()
    const outcome = handleMessage(state, 'p2', { type: 'playAgain' }, ids, ['p1', 'p2'])
    expect(errorOf(outcome)).toMatchObject({ code: 'NOT_HOST' })
    expect(outcome.changed).toBe(false)
  })

  it('lets anyone go while the host is away, and makes them host', () => {
    const { state, ids } = finished()
    const outcome = handleMessage(state, 'p2', { type: 'playAgain' }, ids, ['p2'])
    expect(outcome.state.game.status).toBe('lobby')
    expect(outcome.state.hostId).toBe('p2')
  })

  it('refuses before the game is over', () => {
    const { state, ids } = started()
    const outcome = handleMessage(state, 'p1', { type: 'playAgain' }, ids, ['p1', 'p2'])
    expect(errorOf(outcome)).toMatchObject({ code: 'GAME_NOT_OVER' })
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

describe('public rooms', () => {
  it('lets only the host list the room, and sends the flag in every state', () => {
    const { state, ids } = roomWith(['Ann', 'Bob'])
    expect(stateMessage(state, 'p2', [])).toMatchObject({ public: false })
    expect(
      errorOf(handleMessage(state, 'p2', { type: 'setPublic', public: true }, ids, [])),
    ).toMatchObject({ code: 'NOT_HOST' })
    const outcome = handleMessage(state, 'p1', { type: 'setPublic', public: true }, ids, [])
    expect(outcome.changed).toBe(true)
    expect(outcome.broadcast).toBe(true)
    expect(stateMessage(outcome.state, 'p2', [])).toMatchObject({ public: true })
  })

  it('reads a room saved before public rooms as private', () => {
    const { state } = roomWith(['Ann'])
    const old: RoomState = { ...state }
    delete old.public
    expect(stateMessage(old, 'p1', [])).toMatchObject({ public: false })
  })
})

describe('blocking a kicked player', () => {
  /** Ann joins from home, Bob from the cafe. */
  function lobby() {
    const ids = sequentialIds()
    let state = createRoom('ABCDEF', SEED)
    state = handleMessage(state, null, { type: 'join', name: 'Ann' }, ids, [], 'home').state
    state = handleMessage(state, null, { type: 'join', name: 'Bob' }, ids, [], 'cafe').state
    return { state, ids }
  }

  it('records where each player joined from', () => {
    expect(lobby().state.addresses).toEqual({ p1: 'home', p2: 'cafe' })
  })

  it("blocks a kicked player's address from taking a new seat", () => {
    const { state, ids } = lobby()
    const kicked = handleMessage(state, 'p1', { type: 'kick', playerId: 'p2' }, ids, []).state
    expect(blockedAddresses(kicked)).toEqual(['cafe'])
    expect(kicked.addresses).toEqual({ p1: 'home' })

    const again = handleMessage(kicked, null, { type: 'join', name: 'Bobby' }, ids, [], 'cafe')
    expect(again.changed).toBe(false)
    expect(errorOf(again)).toMatchObject({ code: 'BLOCKED' })
    const elsewhere = handleMessage(kicked, null, { type: 'join', name: 'Cy' }, ids, [], 'park')
    expect(elsewhere.bindPlayerId).toBe('p3')
  })

  it('lets a seated player on the blocked network rejoin with their token', () => {
    const ids = sequentialIds()
    let state = createRoom('ABCDEF', SEED)
    for (const name of ['Ann', 'Bob', 'Cy']) {
      state = handleMessage(state, null, { type: 'join', name }, ids, [], 'cafe').state
    }
    state = handleMessage(state, 'p1', { type: 'kick', playerId: 'p2' }, ids, []).state
    const rejoin = handleMessage(
      state,
      null,
      { type: 'join', name: 'Cy', token: 't3' },
      ids,
      [],
      'cafe',
    )
    expect(rejoin.bindPlayerId).toBe('p3')
  })

  it('does not block a player who left on their own', () => {
    const { state, ids } = lobby()
    const left = handleMessage(state, 'p2', { type: 'leave' }, ids, []).state
    expect(blockedAddresses(left)).toEqual([])
    const back = handleMessage(left, null, { type: 'join', name: 'Bob' }, ids, [], 'cafe')
    expect(back.bindPlayerId).toBe('p3')
  })

  it('blocks nothing when it never knew the address', () => {
    const { state, ids } = roomWith(['Ann', 'Bob'])
    const kicked = handleMessage(state, 'p1', { type: 'kick', playerId: 'p2' }, ids, []).state
    expect(blockedAddresses(kicked)).toEqual([])
  })

  it('records a new address when a player rejoins from another network', () => {
    const { state, ids } = lobby()
    const rejoin = handleMessage(
      state,
      null,
      { type: 'join', name: 'Bob', token: 't2' },
      ids,
      [],
      'train',
    )
    expect(rejoin.changed).toBe(true)
    expect(rejoin.state.addresses).toEqual({ p1: 'home', p2: 'train' })
    const same = handleMessage(
      state,
      null,
      { type: 'join', name: 'Bob', token: 't2' },
      ids,
      [],
      'cafe',
    )
    expect(same.changed).toBe(false)
  })
})

describe('unkick', () => {
  function kickedBob() {
    const ids = sequentialIds()
    let state = createRoom('ABCDEF', SEED)
    state = handleMessage(state, null, { type: 'join', name: 'Ann' }, ids, [], 'home').state
    state = handleMessage(state, null, { type: 'join', name: 'Bob' }, ids, [], 'cafe').state
    state = handleMessage(state, 'p1', { type: 'kick', playerId: 'p2' }, ids, []).state
    return { state, ids }
  }

  it('shows the host, and only the host, who was kicked', () => {
    const { state, ids } = kickedBob()
    const withCy = handleMessage(state, null, { type: 'join', name: 'Cy' }, ids, [], 'park').state
    expect(stateMessage(withCy, 'p1', [])).toMatchObject({
      kicked: [{ playerId: 'p2', name: 'Bob' }],
    })
    expect(stateMessage(withCy, 'p3', [])).toMatchObject({ kicked: [] })
  })

  it('lets the kicked player join again, in a new seat', () => {
    const { state, ids } = kickedBob()
    const outcome = handleMessage(state, 'p1', { type: 'unkick', playerId: 'p2' }, ids, [])
    expect(outcome.changed).toBe(true)
    expect(outcome.broadcast).toBe(true)
    expect(outcome.state.kicked).toEqual([])
    const back = handleMessage(outcome.state, null, { type: 'join', name: 'Bob' }, ids, [], 'cafe')
    expect(back.bindPlayerId).toBe('p3')
  })

  it('keeps blocking a network another kicked player shares', () => {
    const ids = sequentialIds()
    let state = createRoom('ABCDEF', SEED)
    for (const name of ['Ann', 'Bob', 'Cy']) {
      const address = name === 'Ann' ? 'home' : 'cafe'
      state = handleMessage(state, null, { type: 'join', name }, ids, [], address).state
    }
    state = handleMessage(state, 'p1', { type: 'kick', playerId: 'p2' }, ids, []).state
    state = handleMessage(state, 'p1', { type: 'kick', playerId: 'p3' }, ids, []).state
    state = handleMessage(state, 'p1', { type: 'unkick', playerId: 'p2' }, ids, []).state
    expect(blockedAddresses(state)).toEqual(['cafe'])
  })

  it('is host only', () => {
    const { state, ids } = kickedBob()
    const withCy = handleMessage(state, null, { type: 'join', name: 'Cy' }, ids, [], 'park').state
    expect(
      errorOf(handleMessage(withCy, 'p3', { type: 'unkick', playerId: 'p2' }, ids, [])),
    ).toMatchObject({ code: 'NOT_HOST' })
  })

  it('rejects someone who was never kicked', () => {
    const { state, ids } = kickedBob()
    expect(
      errorOf(handleMessage(state, 'p1', { type: 'unkick', playerId: 'p9' }, ids, [])),
    ).toMatchObject({ code: 'NO_SUCH_PLAYER' })
  })
})
