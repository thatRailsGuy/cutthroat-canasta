import { DurableObject } from 'cloudflare:workers'
import type { Seed } from '@canasta/engine'
import { addressKey, clientIp } from './address'
import { allowSend, appendLine, stampLine } from './chat'
import { randomSeed } from './codes'
import { isStale, lastSeen } from './presence'
import {
  HEARTBEAT_PING,
  HEARTBEAT_PONG,
  STALE_CLOSE_CODE,
  parseClientMessage,
  type ChatLine,
  type ServerMessage,
} from './protocol'
import { createRoom, handleMessage, stateMessage, type RoomIds, type RoomState } from './room'
import { REFRESH_MS, tableListing } from './tables'

interface Attachment {
  playerId: string | null
  /** When the socket connected or last sent a message (ms). Pings are tracked by the runtime. */
  seenAt: number
  /** The address key (address.ts) it connected from, or null if the request didn't say. */
  address: string | null
}

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

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(HEARTBEAT_PING, HEARTBEAT_PONG))
    ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get<RoomState>('room')) ?? null
      this.chat = (await ctx.storage.get<ChatLine[]>('chat')) ?? []
      this.listed = (await ctx.storage.get<boolean>('listed')) ?? false
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
    // A dropped player's dot must go grey even when this message changed nothing.
    if (outcome.broadcast || droppedPlayer) this.broadcast()
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
   * Set only while the room is listed. It drops silent sockets, so a host whose phone died
   * comes off the list, and tells the directory the room is still there.
   */
  async alarm(): Promise<void> {
    if (this.dropStaleSockets()) this.broadcast()
    await this.report({ refresh: true })
  }

  private async presenceChanged(except?: WebSocket): Promise<void> {
    this.broadcast(except)
    await this.report({ except })
  }

  /**
   * Puts the room on the home page's list, updates its line, or takes it off. `refresh` sends
   * the line even if it hasn't changed. A failure only costs the listing, never the move.
   */
  private async report({
    except,
    refresh = false,
  }: { except?: WebSocket; refresh?: boolean } = {}) {
    if (!this.room) return
    const listing = tableListing(this.room, this.connected(except))
    if (!listing && !this.listed) return
    const json = JSON.stringify(listing)
    const now = Date.now()
    const fresh = this.reported?.json === json && now - this.reported.at < REFRESH_MS
    if (fresh && !refresh) return
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
    if (listing) {
      if ((await this.ctx.storage.getAlarm()) === null) {
        await this.ctx.storage.setAlarm(now + REFRESH_MS)
      }
    } else {
      await this.ctx.storage.deleteAlarm()
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
    const ids = new Set(
      this.ctx
        .getWebSockets()
        .filter((ws) => ws !== except)
        .map((ws) => attachmentOf(ws).playerId),
    )
    return (this.room?.game.players ?? []).map((p) => p.id).filter((id) => ids.has(id))
  }

  private broadcast(except?: WebSocket): void {
    const room = this.room
    if (!room) return
    const connected = this.connected(except)
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue
      const { playerId } = attachmentOf(ws)
      if (playerId) send(ws, stateMessage(room, playerId, connected))
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

function send(ws: WebSocket, message: ServerMessage): void {
  try {
    ws.send(JSON.stringify(message))
  } catch {
    // The socket closed between the event and the send; its player can reconnect with their token.
  }
}
