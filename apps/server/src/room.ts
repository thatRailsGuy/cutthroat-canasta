import {
  addPlayer,
  applyAction,
  createGame,
  leaveGame,
  quitGame,
  redealRound,
  removePlayer,
  restartGame,
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
  /** Listed on the home page while in the lobby. Missing in rooms made before public rooms. */
  public?: boolean
  /** playerId → the address key (address.ts) they last joined from. */
  addresses?: Record<string, string>
  /** Players the host kicked. Their address can't take a new seat until the host lets them in. */
  kicked?: Kick[]
}

export interface Kick {
  playerId: string
  name: string
  /** The address key they last joined from, or null if it was never known (nothing blocked). */
  address: string | null
}

/** The address keys that can't take a new seat. */
export function blockedAddresses(state: RoomState): string[] {
  return (state.kicked ?? []).flatMap((k) => (k.address === null ? [] : [k.address]))
}

export interface RoomIds {
  newPlayerId(): string
  newToken(): string
  /** A fresh shuffle for Play again. */
  newSeed(): Seed
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
  return {
    type: 'state',
    view: viewFor(state.game, playerId),
    hostId: state.hostId,
    connected,
    public: state.public ?? false,
    // Only the host can let anyone back in, so only the host needs the list.
    kicked:
      playerId === state.hostId
        ? (state.kicked ?? []).map(({ playerId, name }) => ({ playerId, name }))
        : [],
  }
}

/** Chat is handled by the Durable Object, which has the clock and the chat log. */
export type RoomMessage = Exclude<ClientMessage, { type: 'chat' }>

/**
 * `connected` lists the players with an open connection, including the sender. `address` is
 * the sender's address key (address.ts), or null when the request didn't say where it came from.
 */
export function handleMessage(
  state: RoomState,
  senderId: string | null,
  message: RoomMessage,
  ids: RoomIds,
  connected: readonly string[],
  address: string | null = null,
): Outcome {
  if (message.type === 'join') {
    return join(state, senderId, message.name, message.token, ids, address)
  }
  if (!senderId) return protocolError(state, 'NOT_JOINED', 'Join the game first.')

  switch (message.type) {
    case 'start':
      return hostOnly(state, senderId, () => fromResult(state, startGame(state.game)))
    case 'nextRound':
      // Any seated player can deal, so a missing host can't stall the table.
      return fromResult(state, startNextRound(state.game))
    case 'redeal':
      return hostOnly(state, senderId, () => fromResult(state, redealRound(state.game, senderId)))
    case 'action':
      return fromResult(state, applyAction(state.game, senderId, message.action))
    case 'leave':
      if (state.game.status === 'lobby') return removeSeat(state, senderId, 'left')
      if (state.game.status === 'gameOver') return leaveFinished(state, senderId)
      return quit(state, senderId)
    case 'kick':
      return hostOnly(state, senderId, () => removeSeat(state, message.playerId, 'kicked'))
    case 'reissue':
      return hostOnly(state, senderId, () => reissue(state, message.playerId, ids, connected))
    case 'playAgain':
      return playAgain(state, senderId, ids, connected)
    case 'unkick':
      return hostOnly(state, senderId, () => unkick(state, message.playerId))
    case 'setPublic':
      return hostOnly(state, senderId, () => ({
        state: { ...state, public: message.public },
        reply: [],
        changed: true,
        broadcast: true,
      }))
  }
}

function join(
  state: RoomState,
  senderId: string | null,
  name: string,
  token: string | undefined,
  ids: RoomIds,
  address: string | null,
): Outcome {
  if (senderId) return protocolError(state, 'ALREADY_JOINED', "You've already joined this game.")

  if (token !== undefined) {
    // A kicked, left or reissued seat's token. Taking a fresh seat instead would leave a ghost
    // seat in the lobby, so the client drops the token. In the lobby the player can join again
    // by name; once the game has started only a new rejoin link from the host helps.
    if (!Object.hasOwn(state.tokens, token)) {
      return protocolError(
        state,
        'UNKNOWN_TOKEN',
        state.game.status === 'lobby'
          ? 'That seat link is no longer valid. Join again with your name.'
          : 'That seat link is no longer valid. Ask the host for a new rejoin link.',
      )
    }
    const playerId = state.tokens[token]
    const next = withAddress(state, playerId, address)
    return {
      state: next,
      reply: [joined(state, playerId, token)],
      bindPlayerId: playerId,
      changed: next !== state,
      broadcast: true,
    }
  }

  // Only a new seat is refused, so someone the host still wants, who shares the kicked
  // player's network, keeps their seat.
  if (address !== null && blockedAddresses(state).includes(address)) {
    return protocolError(
      state,
      'BLOCKED',
      "The host of this game removed you, so you can't join it again.",
    )
  }
  const playerId = ids.newPlayerId()
  const result = addPlayer(state.game, playerId, name)
  if (!result.ok) return ruleErrorOutcome(state, result.error)
  const newToken = ids.newToken()
  const next: RoomState = withAddress(
    {
      ...state,
      game: result.game,
      hostId: state.hostId ?? playerId,
      tokens: { ...state.tokens, [newToken]: playerId },
    },
    playerId,
    address,
  )
  return {
    state: next,
    reply: [joined(next, playerId, newToken)],
    bindPlayerId: playerId,
    changed: true,
    broadcast: true,
  }
}

/**
 * Lobby only (the engine enforces it). If the host goes, the next seat becomes host. A kicked
 * player's address is blocked, so they can't come straight back under a new name.
 */
function removeSeat(state: RoomState, playerId: string, reason: RemovedReason): Outcome {
  if (!isSeated(state, playerId)) return noSuchPlayer(state)
  const result = removePlayer(state.game, playerId)
  if (!result.ok) return ruleErrorOutcome(state, result.error)
  const next: RoomState = {
    ...state,
    game: result.game,
    hostId: state.hostId === playerId ? (result.game.players[0]?.id ?? null) : state.hostId,
    tokens: tokensWithout(state.tokens, playerId),
    addresses: addressesWithout(state.addresses, playerId),
  }
  if (reason === 'kicked') {
    const name = state.game.players.find((p) => p.id === playerId)!.name
    const address = state.addresses?.[playerId] ?? null
    next.kicked = [...(state.kicked ?? []), { playerId, name, address }]
  }
  return { state: next, reply: [], detach: { playerId, reason }, changed: true, broadcast: true }
}

/** Lets a kicked player's address take a new seat again. Their old seat stays gone. */
function unkick(state: RoomState, playerId: string): Outcome {
  if (!state.kicked?.some((k) => k.playerId === playerId)) return noSuchPlayer(state)
  return {
    state: { ...state, kicked: state.kicked.filter((k) => k.playerId !== playerId) },
    reply: [],
    changed: true,
    broadcast: true,
  }
}

/**
 * A player quits a started game. The others play on without them. If the host quits, the next
 * seat after them becomes host at once.
 */
function quit(state: RoomState, playerId: string): Outcome {
  if (!isSeated(state, playerId)) return noSuchPlayer(state)
  const result = quitGame(state.game, playerId)
  if (!result.ok) return ruleErrorOutcome(state, result.error)
  const seat = state.game.players.findIndex((p) => p.id === playerId)
  const players = result.game.players
  const next: RoomState = {
    ...state,
    game: result.game,
    hostId: state.hostId === playerId ? (players[seat % players.length]?.id ?? null) : state.hostId,
    tokens: tokensWithout(state.tokens, playerId),
    addresses: addressesWithout(state.addresses, playerId),
  }
  const { players: before, waiting = [] } = state.game
  const name = [...before, ...waiting].find((p) => p.id === playerId)!.name
  return {
    state: next,
    reply: [],
    detach: { playerId, reason: 'quit' },
    announce: { type: 'playerQuit', playerId, name },
    changed: true,
    broadcast: true,
  }
}

/**
 * A player leaves a finished game, so Play again doesn't seat them. Their score stays in the
 * final standings. If the host leaves, the next seat after them still here becomes host.
 */
function leaveFinished(state: RoomState, playerId: string): Outcome {
  if (!isSeated(state, playerId)) return noSuchPlayer(state)
  const result = leaveGame(state.game, playerId)
  if (!result.ok) return ruleErrorOutcome(state, result.error)
  const next: RoomState = {
    ...state,
    game: result.game,
    hostId: state.hostId === playerId ? nextHost(result.game, playerId) : state.hostId,
    tokens: tokensWithout(state.tokens, playerId),
    addresses: addressesWithout(state.addresses, playerId),
  }
  return {
    state: next,
    reply: [],
    detach: { playerId, reason: 'left' },
    changed: true,
    broadcast: true,
  }
}

/** The first seat after the old host's that is still here, or else anyone waiting. */
function nextHost(game: Game, hostId: string): string | null {
  const { players, waiting = [], left = [] } = game
  const seat = players.findIndex((p) => p.id === hostId)
  const order = [...players.slice(seat + 1), ...players.slice(0, seat + 1), ...waiting]
  return order.find((p) => !left.includes(p.id))?.id ?? null
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
    // The host sees this as a toast after pressing "Seat stuck?" for a player who is still live.
    const name = state.game.players.find((p) => p.id === playerId)?.name ?? 'That player'
    return protocolError(
      state,
      'PLAYER_CONNECTED',
      `${name} is still connected, so they don't need a rejoin link. If they're stuck, try again in a minute.`,
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

/**
 * Takes a finished game back to the lobby with the same players. The host presses it, or
 * anyone while the host is away; then they become host, since the lobby needs one to start.
 */
function playAgain(
  state: RoomState,
  senderId: string,
  ids: RoomIds,
  connected: readonly string[],
): Outcome {
  const hostHere = state.hostId !== null && connected.includes(state.hostId)
  if (hostHere && senderId !== state.hostId) {
    return protocolError(state, 'NOT_HOST', 'Only the host can start another game.')
  }
  const result = restartGame(state.game, ids.newSeed())
  if (!result.ok) return ruleErrorOutcome(state, result.error)
  return {
    state: { ...state, game: result.game, hostId: senderId },
    reply: [],
    changed: true,
    broadcast: true,
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

/** Has a seat at the table, or is waiting to be dealt in, and hasn't left a finished game. */
function isSeated(state: RoomState, playerId: string): boolean {
  const { players, waiting = [], left = [] } = state.game
  return [...players, ...waiting].some((p) => p.id === playerId) && !left.includes(playerId)
}

function tokensWithout(tokens: Record<string, string>, playerId: string): Record<string, string> {
  return Object.fromEntries(Object.entries(tokens).filter(([, id]) => id !== playerId))
}

/** Records where a player joined from. Returns `state` itself when nothing changed. */
function withAddress(state: RoomState, playerId: string, address: string | null): RoomState {
  if (address === null || state.addresses?.[playerId] === address) return state
  return { ...state, addresses: { ...state.addresses, [playerId]: address } }
}

function addressesWithout(
  addresses: Record<string, string> | undefined,
  playerId: string,
): Record<string, string> | undefined {
  if (!addresses) return undefined
  return Object.fromEntries(Object.entries(addresses).filter(([id]) => id !== playerId))
}

function joined(state: RoomState, playerId: string, token: string): ServerMessage {
  return { type: 'joined', code: state.code, playerId, token }
}
