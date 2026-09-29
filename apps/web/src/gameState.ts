import { RULE_ERROR_SECTIONS, type PlayerView, type RuleSection } from '@canasta/engine'
import type { RemovedReason, ServerErrorCode, ServerMessage } from '@canasta/server/protocol'
import type { ConnectionStatus } from './connection'

export interface Toast {
  id: number
  message: string
  /** The rules-page anchor for a rule error. Protocol errors have none. */
  section: RuleSection | null
}

/**
 * A seat got a new rejoin link. Kept only in memory, and only for the current round: a player
 * who reconnects misses it.
 */
export interface SeatNotice {
  id: number
  playerId: string
}

export interface GameState {
  connection: ConnectionStatus
  failures: number
  playerId: string | null
  /** A join was sent and has no answer yet. */
  joining: boolean
  view: PlayerView | null
  hostId: string | null
  connected: string[]
  /** Why the last join failed; the page shows the join form with it. */
  joinError: string | null
  toasts: Toast[]
  notices: SeatNotice[]
  /** Host only: the latest rejoin token for each reissued seat. */
  rejoinTokens: Record<string, string>
  removed: RemovedReason | null
  nextId: number
}

export type GameEvent =
  | { type: 'status'; status: ConnectionStatus; failures: number }
  /** `joinFailed`: this error answers a join that was in flight. */
  | { type: 'message'; message: ServerMessage; joinFailed: boolean }
  | { type: 'dismissToast'; id: number }
  /** A message the client couldn't send, because the socket isn't open. */
  | { type: 'notSent' }
  | { type: 'joining' }

export const initialGameState: GameState = {
  connection: 'connecting',
  failures: 0,
  playerId: null,
  joining: false,
  view: null,
  hostId: null,
  connected: [],
  joinError: null,
  toasts: [],
  notices: [],
  rejoinTokens: {},
  removed: null,
  nextId: 1,
}

const MAX_TOASTS = 3
export const NOT_SENT_MESSAGE = 'Not connected. Try again in a moment.'
const MAX_NOTICES = 5

export function sectionFor(code: ServerErrorCode): RuleSection | null {
  return Object.hasOwn(RULE_ERROR_SECTIONS, code)
    ? RULE_ERROR_SECTIONS[code as keyof typeof RULE_ERROR_SECTIONS]
    : null
}

export function gameReducer(state: GameState, event: GameEvent): GameState {
  switch (event.type) {
    case 'status':
      return { ...state, connection: event.status, failures: event.failures }
    case 'joining':
      return { ...state, joining: true, joinError: null }
    case 'dismissToast':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== event.id) }
    case 'notSent':
      return addToast(state, NOT_SENT_MESSAGE, null)
    case 'message':
      return onMessage(state, event.message, event.joinFailed)
  }
}

function addToast(state: GameState, message: string, section: RuleSection | null): GameState {
  const toast = { id: state.nextId, message, section }
  return {
    ...state,
    toasts: [...state.toasts, toast].slice(-MAX_TOASTS),
    nextId: state.nextId + 1,
  }
}

function onMessage(state: GameState, message: ServerMessage, joinFailed: boolean): GameState {
  switch (message.type) {
    case 'joined':
      return { ...state, playerId: message.playerId, joining: false, removed: null }
    case 'state': {
      // Seat notices belong to the round they happened in. This is also true on the first state
      // after joining (no view yet), which is harmless: there are no notices to lose then.
      const newRound = message.view.round?.number !== state.view?.round?.number
      return {
        ...state,
        view: message.view,
        hostId: message.hostId,
        connected: message.connected,
        notices: newRound ? [] : state.notices,
      }
    }
    case 'error': {
      if (joinFailed) {
        // This socket has no seat, so anything left from an earlier seat (say a reissued one)
        // is stale. Clearing it lets the page show the join form with the error.
        return {
          ...state,
          joining: false,
          joinError: message.message,
          playerId: initialGameState.playerId,
          view: initialGameState.view,
          hostId: initialGameState.hostId,
          connected: initialGameState.connected,
        }
      }
      // Two players can press Next round together; the second one's ROUND_NOT_OVER is noise.
      if (message.code === 'ROUND_NOT_OVER') return state
      return addToast(state, message.message, sectionFor(message.code))
    }
    case 'removed':
      return { ...state, removed: message.reason, playerId: null }
    case 'reissued':
      return {
        ...state,
        rejoinTokens: { ...state.rejoinTokens, [message.playerId]: message.token },
      }
    case 'seatReissued': {
      const notice = { id: state.nextId, playerId: message.playerId }
      return {
        ...state,
        notices: [notice, ...state.notices].slice(0, MAX_NOTICES),
        nextId: state.nextId + 1,
      }
    }
    case 'pong':
      return state
  }
}
