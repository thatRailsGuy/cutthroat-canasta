import {
  addPlayer,
  applyAction,
  createGame,
  startGame,
  startNextRound,
  viewFor,
  type Game,
  type GameResult,
  type RuleError,
  type Seed,
} from '@canasta/engine'
import type { ClientMessage, ProtocolErrorCode, ServerMessage } from './protocol'

export interface RoomState {
  code: string
  game: Game
  hostId: string | null
  /** token → playerId */
  tokens: Record<string, string>
}

export interface RoomIds {
  newPlayerId(): string
  newToken(): string
}

export interface Outcome {
  state: RoomState
  /** Messages for the sender only, sent before any broadcast. */
  reply: ServerMessage[]
  /** Attach this player to the sender's connection. */
  bindPlayerId?: string
  /** The state changed: save it. */
  changed: boolean
  /** Send every joined connection its view. */
  broadcast: boolean
}

export function createRoom(code: string, seed: Seed): RoomState {
  return { code, game: createGame(seed), hostId: null, tokens: {} }
}

export function stateMessage(
  state: RoomState,
  playerId: string,
  connected: string[],
): ServerMessage {
  return { type: 'state', view: viewFor(state.game, playerId), hostId: state.hostId, connected }
}

export function handleMessage(
  state: RoomState,
  senderId: string | null,
  message: ClientMessage,
  ids: RoomIds,
): Outcome {
  switch (message.type) {
    case 'join':
      return join(state, senderId, message.name, message.token, ids)
    case 'start':
      return hostOnly(state, senderId, () => startGame(state.game))
    case 'nextRound':
      return hostOnly(state, senderId, () => startNextRound(state.game))
    case 'action':
      if (!senderId) return protocolError(state, 'NOT_JOINED', 'Join the game first.')
      return fromResult(state, applyAction(state.game, senderId, message.action))
  }
}

function join(
  state: RoomState,
  senderId: string | null,
  name: string,
  token: string | undefined,
  ids: RoomIds,
): Outcome {
  if (senderId) return protocolError(state, 'ALREADY_JOINED', "You've already joined this game.")

  if (token !== undefined && Object.hasOwn(state.tokens, token)) {
    const playerId = state.tokens[token]
    return {
      state,
      reply: [joined(state, playerId, token)],
      bindPlayerId: playerId,
      changed: false,
      broadcast: true,
    }
  }

  const playerId = ids.newPlayerId()
  const result = addPlayer(state.game, playerId, name)
  if (!result.ok) return ruleErrorOutcome(state, result.error)
  const newToken = ids.newToken()
  const next: RoomState = {
    ...state,
    game: result.game,
    hostId: state.hostId ?? playerId,
    tokens: { ...state.tokens, [newToken]: playerId },
  }
  return {
    state: next,
    reply: [joined(next, playerId, newToken)],
    bindPlayerId: playerId,
    changed: true,
    broadcast: true,
  }
}

function hostOnly(state: RoomState, senderId: string | null, run: () => GameResult): Outcome {
  if (!senderId) return protocolError(state, 'NOT_JOINED', 'Join the game first.')
  if (senderId !== state.hostId)
    return protocolError(state, 'NOT_HOST', 'Only the host can do that.')
  return fromResult(state, run())
}

function fromResult(state: RoomState, result: GameResult): Outcome {
  if (!result.ok) return ruleErrorOutcome(state, result.error)
  return { state: { ...state, game: result.game }, reply: [], changed: true, broadcast: true }
}

function ruleErrorOutcome(state: RoomState, error: RuleError): Outcome {
  return {
    state,
    reply: [{ type: 'error', code: error.code, message: error.message }],
    changed: false,
    broadcast: false,
  }
}

function protocolError(state: RoomState, code: ProtocolErrorCode, message: string): Outcome {
  return { state, reply: [{ type: 'error', code, message }], changed: false, broadcast: false }
}

function joined(state: RoomState, playerId: string, token: string): ServerMessage {
  return { type: 'joined', code: state.code, playerId, token }
}
