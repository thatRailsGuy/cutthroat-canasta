import { RULE_ERROR_SECTIONS, type PlayerView, type RuleSection } from '@canasta/engine'
import type {
  ChatLine,
  RemovedReason,
  ServerErrorCode,
  ServerMessage,
} from '@canasta/server/protocol'
import { CHAT_LINES } from './chat'
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
  /** Table talk, oldest first: the backlog from `chatLog`, then each new line. */
  chat: ChatLine[]
  /** The newest line id the player has seen, or null before the first backlog arrives. */
  chatSeen: number | null
  /** The newest line that came in live, not in a backlog. The chat sound plays for it. */
  chatHeard: ChatLine | null
  /** What the player is typing. Kept here, so it outlives the table's remount at each deal. */
  chatText: string
  /** The text of the last line this player sent, until it comes back or is refused. */
  chatSent: string | null
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
  | { type: 'chatText'; text: string }
  | { type: 'chatSent'; text: string }
  /** Table talk is on screen, so every line so far has been seen. */
  | { type: 'readChat' }

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
  chat: [],
  chatSeen: null,
  chatHeard: null,
  chatText: '',
  chatSent: null,
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

/** Other players' lines the player hasn't seen yet. */
export function unreadChat(state: GameState): number {
  const seen = state.chatSeen
  if (seen === null) return 0
  return state.chat.filter((l) => l.id > seen && l.playerId !== state.playerId).length
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
    case 'chatText':
      return { ...state, chatText: event.text }
    case 'chatSent':
      return { ...state, chatText: '', chatSent: event.text }
    case 'readChat': {
      const newest = state.chat.at(-1)?.id ?? 0
      return newest > (state.chatSeen ?? 0) ? { ...state, chatSeen: newest } : state
    }
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
      const toasted = addToast(state, message.message, sectionFor(message.code))
      if (message.code !== 'CHAT_TOO_FAST' || state.chatSent === null) return toasted
      // Put the refused line back, unless the player has started typing another.
      return {
        ...toasted,
        chatText: state.chatText || state.chatSent,
        chatSent: null,
      }
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
    case 'playerQuit':
      // The one who quit is on their way out; everyone else gets a toast.
      if (message.playerId === state.playerId) return state
      return addToast(state, `${message.name} quit the game.`, null)
    case 'chatLog': {
      // The first backlog was all said before the player arrived, so none of it is unread.
      // After a reconnect, lines that came in while they were away are.
      const newest = message.lines.at(-1)?.id ?? 0
      return { ...state, chat: message.lines, chatSeen: state.chatSeen ?? newest }
    }
    case 'chat': {
      if (message.line.id <= (state.chat.at(-1)?.id ?? 0)) return state
      const mine = message.line.playerId === state.playerId
      return {
        ...state,
        chat: [...state.chat, message.line].slice(-CHAT_LINES),
        chatHeard: message.line,
        chatSent: mine ? null : state.chatSent,
      }
    }
    case 'pong':
      return state
  }
}
