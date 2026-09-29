import { describe, expect, it } from 'vitest'
import { gameReducer, initialGameState, sectionFor, type GameState } from '../src/gameState'
import { makeView } from './fixtures'
import type { ServerMessage } from '@canasta/server/protocol'

const receive = (state: GameState, message: ServerMessage, joinFailed = false) =>
  gameReducer(state, { type: 'message', message, joinFailed })

describe('gameReducer', () => {
  it('records the seat, then the view, host and presence', () => {
    let state = gameReducer(initialGameState, { type: 'joining' })
    expect(state.joining).toBe(true)
    state = receive(state, { type: 'joined', code: 'ABCDEF', playerId: 'you', token: 't' })
    expect(state).toMatchObject({ playerId: 'you', joining: false })
    const view = makeView({ hand: [], phase: 'draw' })
    state = receive(state, { type: 'state', view, hostId: 'you', connected: ['you'] })
    expect(state).toMatchObject({ view, hostId: 'you', connected: ['you'] })
  })

  it('turns rule errors into toasts that link to their section', () => {
    const state = receive(initialGameState, {
      type: 'error',
      code: 'WILDS_EXCEED_NATURALS',
      message: 'Too many wilds.',
    })
    expect(state.toasts).toEqual([{ id: 1, message: 'Too many wilds.', section: 'melds' }])
  })

  it('gives protocol errors no section', () => {
    const state = receive(initialGameState, { type: 'error', code: 'NOT_HOST', message: 'No.' })
    expect(state.toasts[0].section).toBeNull()
  })

  it('ignores ROUND_NOT_OVER, which a second Next round press causes', () => {
    const state = receive(initialGameState, {
      type: 'error',
      code: 'ROUND_NOT_OVER',
      message: 'The next round can only start after this one is scored.',
    })
    expect(state).toBe(initialGameState)
  })

  it('shows a failed join on the join form, not as a toast', () => {
    const joining = gameReducer(initialGameState, { type: 'joining' })
    const state = receive(joining, { type: 'error', code: 'NAME_TAKEN', message: 'Taken.' }, true)
    expect(state).toMatchObject({ joining: false, joinError: 'Taken.', toasts: [] })
  })

  it('forgets the old seat and view when a rejoin fails, so the join form shows', () => {
    let state = receive(initialGameState, {
      type: 'joined',
      code: 'ABCDEF',
      playerId: 'you',
      token: 't',
    })
    const view = makeView({ hand: [], phase: 'draw' })
    state = receive(state, { type: 'state', view, hostId: 'you', connected: ['you', 'bob'] })
    // The socket dropped and the host reissued the seat; the reconnect's join fails.
    state = gameReducer(state, { type: 'joining' })
    state = receive(
      state,
      { type: 'error', code: 'UNKNOWN_TOKEN', message: 'That seat link is no longer valid.' },
      true,
    )
    expect(state).toMatchObject({
      joining: false,
      joinError: 'That seat link is no longer valid.',
      playerId: null,
      view: null,
      hostId: null,
      connected: [],
    })
  })

  it('keeps rejoin tokens for the host and seat notices for everyone', () => {
    let state = receive(initialGameState, { type: 'reissued', playerId: 'bob', token: 'new' })
    state = receive(state, { type: 'seatReissued', playerId: 'bob' })
    expect(state.rejoinTokens).toEqual({ bob: 'new' })
    expect(state.notices).toEqual([{ id: 1, playerId: 'bob' }])
  })

  it('records removal and drops the seat', () => {
    const joined = receive(initialGameState, {
      type: 'joined',
      code: 'ABCDEF',
      playerId: 'you',
      token: 't',
    })
    expect(receive(joined, { type: 'removed', reason: 'kicked' })).toMatchObject({
      removed: 'kicked',
      playerId: null,
    })
  })
})

describe('sectionFor', () => {
  it('maps rule errors to rules sections and protocol errors to null', () => {
    expect(sectionFor('FROZEN_NEEDS_NATURAL_PAIR')).toBe('pickup')
    expect(sectionFor('BAD_MESSAGE')).toBeNull()
  })
})
