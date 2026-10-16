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
  takeOverSeat,
  viewFor,
  type Game,
  type GameResult,
  type RuleError,
  type Seed,
} from '@canasta/engine'
import {
  EMPTY_SEAT_AFTER_MS,
  TAKE_OVER_AFTER_MS,
  hostAway,
  type ClientMessage,
  type EmptySeats,
  type ProtocolErrorCode,
  type RemovedReason,
  type ServerMessage,
} from './protocol'

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
  /**
   * joinId → playerId, for seats taken by name whose client hasn't come back with the token
   * yet. Missing in rooms made before join ids.
   */
  joins?: Record<string, string>
  /** The tokens of seats someone took over → who took them, so a returning player is told. */
  taken?: Record<string, string>
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
  away: Record<string, number> = {},
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
    away,
  }
}

/**
 * The join form's list of empty seats, for a socket that hasn't joined. `present` lists the
 * players with an open connection, players waiting for the next hand too, and `away` says how
 * long each of them without one has been away (ms). A waiting player is listed like a seat, so
 * one who lost their link is told to ask for it too.
 */
export function emptySeats(
  state: RoomState,
  present: readonly string[],
  away: Readonly<Record<string, number>>,
): EmptySeats {
  const { status, players, waiting = [] } = state.game
  const started = status === 'playing' || status === 'roundOver'
  if (!started) return { started, host: null, away: [] }
  const seated = [...players, ...waiting]
  const host = seated.find((p) => p.id === state.hostId)
  return {
    started,
    host: host && present.includes(host.id) ? host.name : null,
    away: seated
      .filter((p) => !present.includes(p.id) && (away[p.id] ?? 0) >= EMPTY_SEAT_AFTER_MS)
      .map((p) => ({ name: p.name, host: p.id === state.hostId })),
  }
}

/**
 * Which addresses get an empty list instead, so a kicked player learns nothing more about the
 * table. A socket whose address isn't known could be a kicked player's, so it gets an empty
 * list too once anyone has been kicked. With nobody kicked, as in local dev, it gets the list.
 */
export function seatsHiddenFrom(state: RoomState): (address: string | null) => boolean {
  const blocked = new Set(blockedAddresses(state))
  const anyKicked = (state.kicked ?? []).length > 0
  return (address) => (address === null ? anyKicked : blocked.has(address))
}

/** Chat is handled by the Durable Object, which has the clock and the chat log. */
export type RoomMessage = Exclude<ClientMessage, { type: 'chat' }>

/**
 * `connected` lists the players with an open connection, including the sender. `address` is
 * the sender's address key (address.ts), or null when the request didn't say where it came from.
 * `away` says how long each seated player without a connection has been away (ms).
 */
export function handleMessage(
  state: RoomState,
  senderId: string | null,
  message: RoomMessage,
  ids: RoomIds,
  connected: readonly string[],
  address: string | null = null,
  away: Readonly<Record<string, number>> = {},
): Outcome {
  if (message.type === 'join') return join(state, senderId, message, ids, address)
  if (!senderId) return protocolError(state, 'NOT_JOINED', 'Join the game first.')

  const outcome = route(state, senderId, message, ids, connected, away)
  // Everyone's Table talk says who stood in for an away host, unless the outcome's own notice
  // already does (a rejoin link names the new host).
  if (outcome.state.hostId === senderId && state.hostId !== senderId && !outcome.announce) {
    return { ...outcome, announce: { type: 'standInHost', playerId: senderId, via: message.type } }
  }
  return outcome
}

function route(
  state: RoomState,
  senderId: string,
  message: Exclude<RoomMessage, { type: 'join' }>,
  ids: RoomIds,
  connected: readonly string[],
  away: Readonly<Record<string, number>>,
): Outcome {
  switch (message.type) {
    case 'start':
      return start(state, senderId, connected, away)
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
      return reissue(state, senderId, message.playerId, ids, connected, away)
    case 'takeOver':
      return takeOver(state, senderId, message.playerId, ids, connected, away)
    case 'playAgain':
      return playAgain(state, senderId, ids, connected, away)
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
  { name, token, joinId, fallbackToName }: Extract<RoomMessage, { type: 'join' }>,
  ids: RoomIds,
  address: string | null,
): Outcome {
  if (senderId) return protocolError(state, 'ALREADY_JOINED', "You've already joined this game.")

  // A retry of a join that took a seat, but whose `joined` never arrived. It gets that seat.
  const retried = joinId !== undefined ? seatOfJoin(state, joinId) : null
  if (retried) {
    const next = withAddress(state, retried.playerId, address)
    return {
      state: next,
      reply: [joined(state, retried.playerId, retried.token)],
      bindPlayerId: retried.playerId,
      changed: next !== state,
      broadcast: true,
    }
  }

  if (token !== undefined) {
    // A kicked, left or reissued seat's token. Taking a fresh seat instead would leave a ghost
    // seat in the lobby, so the client drops the token. In the lobby the player can join again
    // by name, and the client asks for that up front when it knows their name; once the game
    // has started only a new rejoin link from the host helps.
    if (state.taken && Object.hasOwn(state.taken, token)) {
      return protocolError(
        state,
        'SEAT_TAKEN',
        `${state.taken[token]} took over your seat while you were away. You can join again and be dealt in with the next hand.`,
      )
    }
    if (!Object.hasOwn(state.tokens, token)) {
      const error = protocolError(
        state,
        'UNKNOWN_TOKEN',
        state.game.status === 'lobby'
          ? 'That seat link is no longer valid. Join again with your name.'
          : 'That seat link is no longer valid. Ask the host for a new rejoin link.',
      )
      if (!fallbackToName || state.game.status !== 'lobby') return error
      // A name that is taken is most likely their own seat, reissued: the old answer fits.
      const byName = newSeat(state, name, joinId, ids, address)
      return byName.bindPlayerId ? byName : error
    }
    // The client has the token now, so its join id is no longer needed.
    const playerId = state.tokens[token]
    const next = withAddress(withoutJoins(state, playerId), playerId, address)
    return {
      state: next,
      reply: [joined(state, playerId, token)],
      bindPlayerId: playerId,
      changed: next !== state,
      broadcast: true,
    }
  }

  return newSeat(state, name, joinId, ids, address)
}

function newSeat(
  state: RoomState,
  name: string,
  joinId: string | undefined,
  ids: RoomIds,
  address: string | null,
): Outcome {
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
      ...(joinId !== undefined && { joins: { ...state.joins, [joinId]: playerId } }),
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

/** The seat a join id took, and its token, if the seat still has one. */
function seatOfJoin(state: RoomState, joinId: string): { playerId: string; token: string } | null {
  if (!state.joins || !Object.hasOwn(state.joins, joinId)) return null
  const playerId = state.joins[joinId]
  const token = Object.keys(state.tokens).find((t) => state.tokens[t] === playerId)
  return token === undefined ? null : { playerId, token }
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
    joins: joinsWithout(state.joins, playerId),
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
    joins: joinsWithout(state.joins, playerId),
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
    joins: joinsWithout(state.joins, playerId),
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
 * Replaces a disconnected player's tokens with a new one, which the sender shares as a link.
 * The host does it, or anyone once the host has been away a while (HOST_AWAY_AFTER_MS); then
 * they become host, so a table whose host lost their seat isn't stuck. The whole table is told,
 * so nobody can quietly take over a seat and read its hand.
 */
function reissue(
  state: RoomState,
  senderId: string,
  playerId: string,
  ids: RoomIds,
  connected: readonly string[],
  away: Readonly<Record<string, number>>,
): Outcome {
  if (senderId !== state.hostId && !hostAway(state.hostId, connected, away)) {
    return protocolError(state, 'NOT_HOST', 'Only the host can do that.')
  }
  if (!isSeated(state, playerId)) return noSuchPlayer(state)
  if (connected.includes(playerId)) {
    // The sender sees this as a toast after pressing "Seat stuck?" for a player who is still live.
    const name = state.game.players.find((p) => p.id === playerId)?.name ?? 'That player'
    return protocolError(
      state,
      'PLAYER_CONNECTED',
      `${name} is still connected, so they don't need a rejoin link. If they're stuck, try again in a minute.`,
    )
  }
  const token = ids.newToken()
  const newHost = senderId !== state.hostId
  // A join id left from the seat's first join must not lead to the new token.
  const next: RoomState = {
    ...withoutJoins(state, playerId),
    hostId: senderId,
    tokens: { ...tokensWithout(state.tokens, playerId), [token]: playerId },
  }
  return {
    state: next,
    reply: [{ type: 'reissued', playerId, token }],
    announce: newHost
      ? { type: 'seatReissued', playerId, newHost: senderId }
      : { type: 'seatReissued', playerId },
    changed: true,
    // Everyone's view shows the host, so a new one needs a broadcast.
    broadcast: newHost,
  }
}

/**
 * A player waiting for the next hand takes over a seat whose player has been away for a while.
 * Their socket moves to the seat, and the seat's old tokens stop working, so its player can't
 * come back and play the same hand. If the seat was the host's, the new player is host.
 */
function takeOver(
  state: RoomState,
  senderId: string,
  playerId: string,
  ids: RoomIds,
  connected: readonly string[],
  away: Readonly<Record<string, number>>,
): Outcome {
  const { players, waiting = [] } = state.game
  if (!waiting.some((p) => p.id === senderId)) {
    return protocolError(
      state,
      'NOT_WAITING',
      'Only a player waiting for the next hand can take over a seat.',
    )
  }
  const seat = players.find((p) => p.id === playerId)
  if (!seat) return noSuchPlayer(state)
  if (connected.includes(playerId)) {
    return protocolError(
      state,
      'PLAYER_CONNECTED',
      `${seat.name} is back, so their seat is theirs again.`,
    )
  }
  if ((away[playerId] ?? 0) < TAKE_OVER_AFTER_MS) {
    return protocolError(
      state,
      'SEAT_NOT_AWAY',
      `${seat.name} has only just gone. You can take over their seat once they've been away for 2 minutes.`,
    )
  }
  const result = takeOverSeat(state.game, playerId, senderId)
  if (!result.ok) return ruleErrorOutcome(state, result.error)
  const token = ids.newToken()
  const taker = waiting.find((p) => p.id === senderId)!.name
  const oldTokens = Object.keys(state.tokens).filter((t) => state.tokens[t] === playerId)
  const address = state.addresses?.[senderId]
  const addresses = addressesWithout(addressesWithout(state.addresses, playerId), senderId)
  const next: RoomState = {
    ...state,
    game: result.game,
    hostId: state.hostId === senderId ? playerId : state.hostId,
    tokens: {
      ...tokensWithout(tokensWithout(state.tokens, playerId), senderId),
      [token]: playerId,
    },
    joins: joinsWithout(joinsWithout(state.joins, playerId), senderId),
    addresses: address === undefined ? addresses : { ...addresses, [playerId]: address },
    taken: { ...state.taken, ...Object.fromEntries(oldTokens.map((t) => [t, taker])) },
  }
  return {
    state: next,
    reply: [joined(next, playerId, token)],
    bindPlayerId: playerId,
    // Any other tab still in the waiting spot has nothing left to show.
    detach: { playerId: senderId, reason: 'left' },
    changed: true,
    broadcast: true,
  }
}

/**
 * Takes a finished game back to the lobby with the same players. The host presses it, or
 * anyone once the host has been away a while; then they become host, since the lobby needs one
 * to start.
 */
function playAgain(
  state: RoomState,
  senderId: string,
  ids: RoomIds,
  connected: readonly string[],
  away: Readonly<Record<string, number>>,
): Outcome {
  if (senderId !== state.hostId && !hostAway(state.hostId, connected, away)) {
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

/**
 * Starts the game from the lobby. The host presses it, or anyone once the host has been away a
 * while; then, as with play again and rejoin links, they become host, so a lobby whose host went
 * away can still start. They become host only if the game starts. Kick and listing the table
 * stay host-only: they decide who sits at the table, and a host who was away for a minute
 * could come back to find themselves kicked from their own table.
 */
function start(
  state: RoomState,
  senderId: string,
  connected: readonly string[],
  away: Readonly<Record<string, number>>,
): Outcome {
  if (senderId !== state.hostId && !hostAway(state.hostId, connected, away)) {
    return protocolError(state, 'NOT_HOST', 'Only the host can do that.')
  }
  const result = startGame(state.game)
  if (!result.ok) return ruleErrorOutcome(state, result.error)
  return {
    state: { ...state, game: result.game, hostId: senderId },
    reply: [],
    changed: true,
    broadcast: true,
  }
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

function joinsWithout(
  joins: Record<string, string> | undefined,
  playerId: string,
): Record<string, string> | undefined {
  if (!joins) return undefined
  return Object.fromEntries(Object.entries(joins).filter(([, id]) => id !== playerId))
}

/** Drops a player's join ids. Returns `state` itself when they had none. */
function withoutJoins(state: RoomState, playerId: string): RoomState {
  if (!Object.values(state.joins ?? {}).includes(playerId)) return state
  return { ...state, joins: joinsWithout(state.joins, playerId) }
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
