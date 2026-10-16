import { DurableObject } from 'cloudflare:workers'
import type { Seed } from '@canasta/engine'
import { addressKey, clientIp } from './address'
import { allowSend, appendLine, stampLine } from './chat'
import { randomSeed } from './codes'
import { isStale, lastSeen } from './presence'
import {
  EMPTY_SEAT_AFTER_MS,
  HEARTBEAT_PING,
  HEARTBEAT_PONG,
  STALE_CLOSE_CODE,
  parseClientMessage,
  type ChatLine,
  type ServerMessage,
} from './protocol'
import {
  createRoom,
  emptySeats,
  handleMessage,
  seatsHiddenFrom,
  stateMessage,
  type RoomIds,
  type RoomState,
} from './room'
import { REFRESH_MS, tableListing } from './tables'

interface Attachment {
  playerId: string | null
  /** When the socket connected or last sent a message (ms). Pings are tracked by the runtime. */
  seenAt: number
  /** The address key (address.ts) it connected from, or null if the request didn't say. */
  address: string | null
  /**
   * A hash of the empty seats last sent to it while it hasn't joined, so the same list isn't sent
   * again. Kept here rather than in memory, so it survives hibernation.
   */
  seats?: string
}

/**
 * How often a room with anyone connected checks for silent sockets. With STALE_AFTER_MS, a phone
 * that died without closing its socket shows as away 70 to 100 seconds after its last ping.
 */
const PRESENCE_CHECK_MS = 30_000

const ids: RoomIds = {
  newPlayerId: () => crypto.randomUUID(),
  newToken: () => crypto.randomUUID(),
  newSeed: randomSeed,
}

export class GameRoom extends DurableObject<Env> {
  private room: RoomState | null = null
  /** Kept under its own key, so a line doesn't rewrite the game and a move doesn't rewrite chat. */
  private chat: ChatLine[] = []
  /**
   * Each player's recent send times, for the rate limit. Only in memory: hibernation clears it,
   * which is fine, because a room only hibernates once it has gone quiet.
   */
  private chatTimes = new Map<string, number[]>()
  /** Whether the directory lists the room. Saved, so a woken room knows to take itself off. */
  private listed = false
  /** The listing last sent to the directory, and when, to skip sending the same one again. */
  private reported: { json: string; at: number } | null = null
  /**
   * playerId → when each player without a connection went away (ms), players waiting for the
   * next hand too. Saved, so it survives hibernation: a seat can be taken over only after a while
   * away.
   */
  private awaySince: Record<string, number> = {}
  /**
   * The time updateSeats last asked the alarm for, so it doesn't read the alarm again for the same
   * away seat. Only in memory: after hibernation it reads it once more. alarm() forgets it, since
   * it moves the alarm.
   */
  private seatsAlarm: number | null = null

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(HEARTBEAT_PING, HEARTBEAT_PONG))
    ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get<RoomState>('room')) ?? null
      this.chat = (await ctx.storage.get<ChatLine[]>('chat')) ?? []
      this.listed = (await ctx.storage.get<boolean>('listed')) ?? false
      this.awaySince = (await ctx.storage.get<Record<string, number>>('away')) ?? {}
    })
  }

  /** Called once by the Worker when it allocates a game code. Returns false if the code is taken. */
  async init(code: string, seed: Seed): Promise<boolean> {
    if (this.room) return false
    this.room = createRoom(code, seed)
    await this.ctx.storage.put('room', this.room)
    return true
  }

  /** Whether a game was created under this code. Never writes storage. */
  exists(): boolean {
    return this.room !== null
  }

  async fetch(request: Request): Promise<Response> {
    if (!this.room) return new Response('Game not found', { status: 404 })
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected a WebSocket upgrade', { status: 426 })
    }
    const ip = clientIp(request)
    const address = ip ? await addressKey(this.room.code, ip) : null
    const [client, server] = Object.values(new WebSocketPair())
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ playerId: null, seenAt: Date.now(), address } satisfies Attachment)
    if ((await this.ctx.storage.getAlarm()) === null) {
      await this.ctx.storage.setAlarm(Date.now() + PRESENCE_CHECK_MS)
    }
    // The join form's first list.
    await this.updateSeats()
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (!this.room) return
    const { playerId, address } = attachmentOf(ws)
    reattach(ws, { seenAt: Date.now() })
    const droppedPlayer = this.dropStaleSockets()
    const parsed = parseClientMessage(raw)
    if (!parsed.ok) {
      send(ws, parsed.error)
      if (droppedPlayer) await this.presenceChanged()
      return
    }
    if (parsed.message.type === 'chat') {
      await this.addChat(ws, playerId, parsed.message.text)
      if (droppedPlayer) await this.presenceChanged()
      return
    }

    const outcome = handleMessage(
      this.room,
      playerId,
      parsed.message,
      ids,
      this.connected(),
      address ?? null,
      this.awayFor(),
    )
    if (outcome.changed) {
      this.room = outcome.state
      await this.ctx.storage.put('room', this.room)
    }
    if (outcome.bindPlayerId) reattach(ws, { playerId: outcome.bindPlayerId, seenAt: Date.now() })
    for (const message of outcome.reply) send(ws, message)
    // The backlog goes to a socket that just took a seat, before its first state.
    if (outcome.bindPlayerId) send(ws, { type: 'chatLog', lines: this.chat })
    if (outcome.announce) this.announce(outcome.announce)
    if (outcome.detach) {
      const { playerId: gone, reason } = outcome.detach
      for (const socket of this.ctx.getWebSockets()) {
        if (attachmentOf(socket).playerId !== gone) continue
        reattach(socket, { playerId: null, seenAt: Date.now() })
        send(socket, { type: 'removed', reason })
      }
    }
    const awayChanged = await this.trackAway()
    // A dropped player's dot must go grey even when this message changed nothing.
    if (outcome.broadcast || droppedPlayer || awayChanged) this.broadcast()
    await this.updateSeats()
    await this.report()
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    try {
      ws.close(code, reason)
    } catch {
      // Already closed, or a reserved close code that can't be echoed.
    }
    this.dropStaleSockets()
    await this.presenceChanged(ws)
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.dropStaleSockets()
    await this.presenceChanged(ws)
  }

  /**
   * Set while anyone is connected. It drops silent sockets, so a phone that died stops counting
   * as connected even when nobody at the table sends anything, and a listed room's host whose
   * phone died comes off the list. It also tells the directory a listed room is still there.
   */
  async alarm(): Promise<void> {
    const dropped = this.dropStaleSockets()
    if ((await this.trackAway()) || dropped) this.broadcast()
    await this.report()
    // Closed sockets are gone from the list, so an empty room stops waking itself. A listing
    // that couldn't be taken off yet gets another try.
    if (this.ctx.getWebSockets().length > 0 || this.listed) {
      await this.ctx.storage.setAlarm(Date.now() + PRESENCE_CHECK_MS)
    }
    // Also lists a seat that has now been away long enough, and sets the alarm for the next.
    this.seatsAlarm = null
    await this.updateSeats()
  }

  private async presenceChanged(except?: WebSocket): Promise<void> {
    await this.trackAway(except)
    this.broadcast(except)
    await this.updateSeats(except)
    await this.report({ except })
  }

  /**
   * Sends each socket that hasn't joined the join form's empty seats, if they changed since it
   * last got them, and sets the alarm for when the next away seat goes on the list. `except` is a
   * socket that is closing. With nobody on the join form, as for most messages, it does nothing.
   */
  private async updateSeats(except?: WebSocket): Promise<void> {
    if (!this.room) return
    const visitors = this.ctx
      .getWebSockets()
      .filter((ws) => ws !== except && !attachmentOf(ws).playerId)
    if (visitors.length === 0) return
    const seats = emptySeats(this.room, this.present(except), this.awayFor())
    const hidden = seatsHiddenFrom(this.room)
    const lists = await Promise.all(
      [seats, { started: seats.started, host: null, away: [] }].map(async (list) => {
        const message: ServerMessage = { type: 'seats', ...list }
        return { message, hash: await hashOf(JSON.stringify(message)) }
      }),
    )
    for (const ws of visitors) {
      const { address, seats: sent } = attachmentOf(ws)
      const { message, hash } = lists[hidden(address ?? null) ? 1 : 0]
      if (sent === hash) continue
      reattach(ws, { seats: hash })
      send(ws, message)
    }
    if (!seats.started) return
    // A seat goes on the list EMPTY_SEAT_AFTER_MS after it went away: wake up for the first.
    const now = Date.now()
    const due = Object.values(this.awaySince)
      .map((since) => since + EMPTY_SEAT_AFTER_MS)
      .filter((at) => at > now)
    if (due.length === 0) return
    const next = Math.min(...due)
    if (next === this.seatsAlarm) return
    this.seatsAlarm = next
    const alarm = await this.ctx.storage.getAlarm()
    if (alarm === null || alarm > next) await this.ctx.storage.setAlarm(next)
  }

  /**
   * Puts the room on the home page's list, updates its line, or takes it off. An unchanged line
   * is sent again once it is REFRESH_MS old. A failure only costs the listing, never the move.
   */
  private async report({ except }: { except?: WebSocket } = {}) {
    if (!this.room) return
    const listing = tableListing(this.room, this.connected(except))
    if (!listing && !this.listed) return
    const json = JSON.stringify(listing)
    const now = Date.now()
    const fresh = this.reported?.json === json && now - this.reported.at < REFRESH_MS
    if (fresh) return
    const directory = this.env.TABLE_DIRECTORY.get(this.env.TABLE_DIRECTORY.idFromName('all'))
    try {
      if (listing) await directory.put(listing)
      else await directory.remove(this.room.code)
    } catch (error) {
      console.error('Could not update the table directory', error)
      return
    }
    this.reported = { json, at: now }
    if (this.listed !== !!listing) {
      this.listed = !!listing
      await this.ctx.storage.put('listed', this.listed)
    }
  }

  private async addChat(ws: WebSocket, playerId: string | null, text: string): Promise<void> {
    if (!this.room || !playerId) {
      send(ws, { type: 'error', code: 'NOT_JOINED', message: 'Join the game first.' })
      return
    }
    const now = Date.now()
    const times = allowSend(this.chatTimes.get(playerId) ?? [], now)
    if (!times) {
      send(ws, {
        type: 'error',
        code: 'CHAT_TOO_FAST',
        message: 'Slow down. Wait a few seconds before you send more.',
      })
      return
    }
    const id = (this.chat.at(-1)?.id ?? 0) + 1
    const line = stampLine(this.room.game, playerId, text, id, now)
    if (!line) {
      send(ws, { type: 'error', code: 'NOT_JOINED', message: 'Join the game first.' })
      return
    }
    this.chatTimes.set(playerId, times)
    this.chat = appendLine(this.chat, line)
    await this.ctx.storage.put('chat', this.chat)
    this.announce({ type: 'chat', line })
  }

  /**
   * Notes when each player, or player waiting for the next hand, lost their last connection, and
   * forgets it once they are back or gone. `except` is a socket that is closing. Returns true if
   * anything changed.
   */
  private async trackAway(except?: WebSocket): Promise<boolean> {
    if (!this.room) return false
    const present = new Set(this.present(except))
    const { players, waiting = [] } = this.room.game
    const now = Date.now()
    const next: Record<string, number> = {}
    for (const { id } of [...players, ...waiting]) {
      if (!present.has(id)) next[id] = this.awaySince[id] ?? now
    }
    const same =
      Object.keys(next).length === Object.keys(this.awaySince).length &&
      Object.entries(next).every(([id, since]) => this.awaySince[id] === since)
    if (same) return false
    this.awaySince = next
    await this.ctx.storage.put('away', next)
    return true
  }

  /** How long each player without a connection has been away (ms), as trackAway notes it. */
  private awayFor(): Record<string, number> {
    const now = Date.now()
    return Object.fromEntries(
      Object.entries(this.awaySince).map(([id, since]) => [id, now - since]),
    )
  }

  /** Sends `message` to every socket bound to a player. */
  private announce(message: ServerMessage): void {
    for (const socket of this.ctx.getWebSockets()) {
      if (attachmentOf(socket).playerId) send(socket, message)
    }
  }

  /**
   * Unbinds and closes sockets that have been silent for too long, such as a phone that died
   * without closing its socket. Their players stop counting as connected, so the host can
   * reissue the seat, and a closed socket can't keep reading the seat's hand afterwards.
   * Returns true if it unbound a seated player, so the caller knows presence changed.
   */
  private dropStaleSockets(): boolean {
    const now = Date.now()
    let droppedPlayer = false
    for (const ws of this.ctx.getWebSockets()) {
      const { playerId, seenAt } = attachmentOf(ws)
      if (!isStale(lastSeen(seenAt, this.ctx.getWebSocketAutoResponseTimestamp(ws)), now)) continue
      if (playerId) droppedPlayer = true
      reattach(ws, { playerId: null })
      try {
        ws.close(STALE_CLOSE_CODE, 'No heartbeat')
      } catch {
        // Already closed.
      }
    }
    return droppedPlayer
  }

  /** Seated players with an open socket, in seat order. `except` is a socket that is closing. */
  private connected(except?: WebSocket): string[] {
    const present = new Set(this.present(except))
    return (this.room?.game.players ?? []).map((p) => p.id).filter((id) => present.has(id))
  }

  /**
   * Players with an open socket, then players waiting for the next hand with one. `except` is a
   * socket that is closing.
   */
  private present(except?: WebSocket): string[] {
    if (!this.room) return []
    const ids = new Set(
      this.ctx
        .getWebSockets()
        .filter((ws) => ws !== except)
        .map((ws) => attachmentOf(ws).playerId),
    )
    const { players, waiting = [] } = this.room.game
    return [...players, ...waiting].map((p) => p.id).filter((id) => ids.has(id))
  }

  private broadcast(except?: WebSocket): void {
    const room = this.room
    if (!room) return
    const connected = this.connected(except)
    const away = this.awayFor()
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue
      const { playerId } = attachmentOf(ws)
      if (playerId) send(ws, stateMessage(room, playerId, connected, away))
    }
  }
}

/** `address` is missing on sockets opened before it was added. */
function attachmentOf(ws: WebSocket): Attachment {
  return ws.deserializeAttachment() as Attachment
}

function reattach(ws: WebSocket, changes: Partial<Attachment>): void {
  ws.serializeAttachment({ ...attachmentOf(ws), ...changes } satisfies Attachment)
}

/** A short hash of a message, small enough to keep in a socket's attachment. */
async function hashOf(json: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json))
  return btoa(String.fromCharCode(...new Uint8Array(digest).slice(0, 16)))
}

function send(ws: WebSocket, message: ServerMessage): void {
  try {
    ws.send(JSON.stringify(message))
  } catch {
    // The socket closed between the event and the send; its player can reconnect with their token.
  }
}
