import { DurableObject } from 'cloudflare:workers'
import type { Seed } from '@canasta/engine'
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

interface Attachment {
  playerId: string | null
  /** When the socket connected or last sent a message (ms). Pings are tracked by the runtime. */
  seenAt: number
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

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(HEARTBEAT_PING, HEARTBEAT_PONG))
    ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get<RoomState>('room')) ?? null
      this.chat = (await ctx.storage.get<ChatLine[]>('chat')) ?? []
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
    const [client, server] = Object.values(new WebSocketPair())
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ playerId: null, seenAt: Date.now() } satisfies Attachment)
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (!this.room) return
    const { playerId } = ws.deserializeAttachment() as Attachment
    ws.serializeAttachment({ playerId, seenAt: Date.now() } satisfies Attachment)
    const droppedPlayer = this.dropStaleSockets()
    const parsed = parseClientMessage(raw)
    if (!parsed.ok) {
      send(ws, parsed.error)
      if (droppedPlayer) this.broadcast()
      return
    }
    if (parsed.message.type === 'chat') {
      await this.addChat(ws, playerId, parsed.message.text)
      if (droppedPlayer) this.broadcast()
      return
    }

    const outcome = handleMessage(this.room, playerId, parsed.message, ids, this.connected())
    if (outcome.changed) {
      this.room = outcome.state
      await this.ctx.storage.put('room', this.room)
    }
    if (outcome.bindPlayerId) {
      ws.serializeAttachment({
        playerId: outcome.bindPlayerId,
        seenAt: Date.now(),
      } satisfies Attachment)
    }
    for (const message of outcome.reply) send(ws, message)
    // The backlog goes to a socket that just took a seat, before its first state.
    if (outcome.bindPlayerId) send(ws, { type: 'chatLog', lines: this.chat })
    if (outcome.announce) this.announce(outcome.announce)
    if (outcome.detach) {
      const { playerId: gone, reason } = outcome.detach
      for (const socket of this.ctx.getWebSockets()) {
        if ((socket.deserializeAttachment() as Attachment).playerId !== gone) continue
        socket.serializeAttachment({ playerId: null, seenAt: Date.now() } satisfies Attachment)
        send(socket, { type: 'removed', reason })
      }
    }
    // A dropped player's dot must go grey even when this message changed nothing.
    if (outcome.broadcast || droppedPlayer) this.broadcast()
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    try {
      ws.close(code, reason)
    } catch {
      // Already closed, or a reserved close code that can't be echoed.
    }
    this.dropStaleSockets()
    this.broadcast(ws)
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.dropStaleSockets()
    this.broadcast(ws)
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
      if ((socket.deserializeAttachment() as Attachment).playerId) send(socket, message)
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
      const { playerId, seenAt } = ws.deserializeAttachment() as Attachment
      if (!isStale(lastSeen(seenAt, this.ctx.getWebSocketAutoResponseTimestamp(ws)), now)) continue
      if (playerId) droppedPlayer = true
      ws.serializeAttachment({ playerId: null, seenAt } satisfies Attachment)
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
        .map((ws) => (ws.deserializeAttachment() as Attachment).playerId),
    )
    return (this.room?.game.players ?? []).map((p) => p.id).filter((id) => ids.has(id))
  }

  private broadcast(except?: WebSocket): void {
    const room = this.room
    if (!room) return
    const connected = this.connected(except)
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue
      const { playerId } = ws.deserializeAttachment() as Attachment
      if (playerId) send(ws, stateMessage(room, playerId, connected))
    }
  }
}

function send(ws: WebSocket, message: ServerMessage): void {
  try {
    ws.send(JSON.stringify(message))
  } catch {
    // The socket closed between the event and the send; its player can reconnect with their token.
  }
}
