import { describe, expect, it } from 'vitest'
import {
  NOT_SENT_MESSAGE,
  gameReducer,
  initialGameState,
  sectionFor,
  unreadChat,
  type GameState,
} from '../src/gameState'
import { makeView } from './fixtures'
import type { ChatLine, ServerMessage } from '@canasta/server/protocol'

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

  it('clears seat notices when a new round starts', () => {
    const view = makeView({ hand: [], phase: 'draw' })
    let state = receive(initialGameState, { type: 'state', view, hostId: 'you', connected: [] })
    state = receive(state, { type: 'seatReissued', playerId: 'bob' })
    state = receive(state, { type: 'state', view, hostId: 'you', connected: [] })
    expect(state.notices).toHaveLength(1)
    const nextRound = { ...view, round: { ...view.round!, number: 2 } }
    state = receive(state, { type: 'state', view: nextRound, hostId: 'you', connected: [] })
    expect(state.notices).toEqual([])
  })

  it('toasts when another player quits, but not for the one who quit', () => {
    const seated = receive(initialGameState, {
      type: 'joined',
      code: 'ABC',
      playerId: 'you',
      token: 't',
    })
    const other = receive(seated, { type: 'playerQuit', playerId: 'bob', name: 'Bob' })
    expect(other.toasts).toEqual([{ id: 1, message: 'Bob quit the game.', section: null }])
    const self = receive(seated, { type: 'playerQuit', playerId: 'you', name: 'You' })
    expect(self.toasts).toEqual([])
  })

  it('toasts a message that could not be sent', () => {
    const state = gameReducer(initialGameState, { type: 'notSent' })
    expect(state.toasts).toEqual([{ id: 1, message: NOT_SENT_MESSAGE, section: null }])
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

describe('table talk', () => {
  const line = (id: number, playerId = 'bob'): ChatLine => ({
    id,
    playerId,
    name: playerId === 'you' ? 'You' : 'Bob',
    text: `line ${id}`,
    at: id,
    anchor: { game: 1, round: null, redeals: 0, after: 0 },
  })
  const seated = receive(initialGameState, {
    type: 'joined',
    code: 'ABCDEF',
    playerId: 'you',
    token: 't',
  })

  it('counts nothing in the first backlog as unread', () => {
    const state = receive(seated, { type: 'chatLog', lines: [line(1), line(2)] })
    expect(state.chat).toHaveLength(2)
    expect(unreadChat(state)).toBe(0)
  })

  it('counts new lines from others until they are read', () => {
    let state = receive(seated, { type: 'chatLog', lines: [] })
    state = receive(state, { type: 'chat', line: line(1) })
    state = receive(state, { type: 'chat', line: line(2, 'you') })
    state = receive(state, { type: 'chat', line: line(3) })
    expect(unreadChat(state)).toBe(2)
    state = gameReducer(state, { type: 'readChat' })
    expect(unreadChat(state)).toBe(0)
  })

  it('ignores a line it already has', () => {
    const state = receive(seated, { type: 'chatLog', lines: [line(1), line(2)] })
    expect(receive(state, { type: 'chat', line: line(2) })).toBe(state)
  })

  it('counts lines that came in during a reconnect as unread', () => {
    let state = receive(seated, { type: 'chatLog', lines: [line(1)] })
    state = receive(state, { type: 'chatLog', lines: [line(1), line(2), line(3)] })
    expect(unreadChat(state)).toBe(2)
  })

  it('clears the input on send, and puts a refused line back', () => {
    let state = gameReducer(seated, { type: 'chatText', text: 'hello' })
    state = gameReducer(state, { type: 'chatSent', text: 'hello' })
    expect(state.chatText).toBe('')
    state = receive(state, { type: 'error', code: 'CHAT_TOO_FAST', message: 'Slow down.' })
    expect(state.chatText).toBe('hello')
    expect(state.toasts.at(-1)?.message).toBe('Slow down.')
  })

  it('leaves a new draft alone when an earlier line is refused', () => {
    let state = gameReducer(seated, { type: 'chatSent', text: 'hello' })
    state = gameReducer(state, { type: 'chatText', text: 'and' })
    state = receive(state, { type: 'error', code: 'CHAT_TOO_FAST', message: 'Slow down.' })
    expect(state.chatText).toBe('and')
  })
})
