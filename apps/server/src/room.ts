import {
  addPlayer,
  applyAction,
  createGame,
  removePlayer,
  startGame,
  startNextRound,
  viewFor,
  type Game,
  type GameResult,
  type RuleError,
  type Seed,
} from '@canasta/engine'
import type { ClientMessage, ProtocolErrorCode, RemovedReason, ServerMessage } from './protocol'

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
  /** This player's seat is gone: tell their connections and unbind them. */
  detach?: { playerId: string; reason: RemovedReason }
  /** A notice for every joined connection, sent after the reply. */
  announce?: ServerMessage
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

/** `connected` lists the players with an open connection, including the sender. */
export function handleMessage(
  state: RoomState,
  senderId: string | null,
  message: ClientMessage,
  ids: RoomIds,
  connected: readonly string[],
): Outcome {
  if (message.type === 'join') return join(state, senderId, message.name, message.token, ids)
  if (!senderId) return protocolError(state, 'NOT_JOINED', 'Join the game first.')

  switch (message.type) {
    case 'start':
      return hostOnly(state, senderId, () => fromResult(state, startGame(state.game)))
    case 'nextRound':
      // Any seated player can deal, so a missing host can't stall the table.
      return fromResult(state, startNextRound(state.game))
    case 'action':
      return fromResult(state, applyAction(state.game, senderId, message.action))
    case 'leave':
      return removeSeat(state, senderId, 'left')
    case 'kick':
      return hostOnly(state, senderId, () => removeSeat(state, message.playerId, 'kicked'))
    case 'reissue':
      return hostOnly(state, senderId, () => reissue(state, message.playerId, ids, connected))
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

/** Lobby only (the engine enforces it). If the host goes, the next seat becomes host. */
function removeSeat(state: RoomState, playerId: string, reason: RemovedReason): Outcome {
  if (!isSeated(state, playerId)) return noSuchPlayer(state)
  const result = removePlayer(state.game, playerId)
  if (!result.ok) return ruleErrorOutcome(state, result.error)
  const next: RoomState = {
    ...state,
    game: result.game,
    hostId: state.hostId === playerId ? (result.game.players[0]?.id ?? null) : state.hostId,
    tokens: tokensWithout(state.tokens, playerId),
  }
  return { state: next, reply: [], detach: { playerId, reason }, changed: true, broadcast: true }
}

/**
 * Replaces a disconnected player's tokens with a new one, which the host shares as a link.
 * The whole table is told, so the host can't quietly take over a seat and read its hand.
 */
function reissue(
  state: RoomState,
  playerId: string,
  ids: RoomIds,
  connected: readonly string[],
): Outcome {
  if (!isSeated(state, playerId)) return noSuchPlayer(state)
  if (connected.includes(playerId)) {
    return protocolError(
      state,
      'PLAYER_CONNECTED',
      "That player is connected, so they don't need a rejoin link.",
    )
  }
  const token = ids.newToken()
  const next: RoomState = {
    ...state,
    tokens: { ...tokensWithout(state.tokens, playerId), [token]: playerId },
  }
  return {
    state: next,
    reply: [{ type: 'reissued', playerId, token }],
    announce: { type: 'seatReissued', playerId },
    changed: true,
    broadcast: false,
  }
}

function hostOnly(state: RoomState, senderId: string, run: () => Outcome): Outcome {
  if (senderId !== state.hostId)
    return protocolError(state, 'NOT_HOST', 'Only the host can do that.')
  return run()
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

function noSuchPlayer(state: RoomState): Outcome {
  return protocolError(state, 'NO_SUCH_PLAYER', "That player isn't at the table.")
}

function isSeated(state: RoomState, playerId: string): boolean {
  return state.game.players.some((p) => p.id === playerId)
}

function tokensWithout(tokens: Record<string, string>, playerId: string): Record<string, string> {
  return Object.fromEntries(Object.entries(tokens).filter(([, id]) => id !== playerId))
}

function joined(state: RoomState, playerId: string, token: string): ServerMessage {
  return { type: 'joined', code: state.code, playerId, token }
}
