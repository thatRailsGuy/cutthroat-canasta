import { DurableObject } from 'cloudflare:workers'
import type { Seed } from '@canasta/engine'
import { isStale, lastSeen } from './presence'
import {
  HEARTBEAT_PING,
  HEARTBEAT_PONG,
  STALE_CLOSE_CODE,
  parseClientMessage,
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
}

export class GameRoom extends DurableObject<Env> {
  private room: RoomState | null = null

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(HEARTBEAT_PING, HEARTBEAT_PONG))
    ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get<RoomState>('room')) ?? null
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
    this.dropStaleSockets()
    const parsed = parseClientMessage(raw)
    if (!parsed.ok) return send(ws, parsed.error)

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
    if (outcome.announce) {
      for (const socket of this.ctx.getWebSockets()) {
        if ((socket.deserializeAttachment() as Attachment).playerId) send(socket, outcome.announce)
      }
    }
    if (outcome.detach) {
      const { playerId: gone, reason } = outcome.detach
      for (const socket of this.ctx.getWebSockets()) {
        if ((socket.deserializeAttachment() as Attachment).playerId !== gone) continue
        socket.serializeAttachment({ playerId: null, seenAt: Date.now() } satisfies Attachment)
        send(socket, { type: 'removed', reason })
      }
    }
    if (outcome.broadcast) this.broadcast()
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

  /**
   * Unbinds and closes sockets that have been silent for too long, such as a phone that died
   * without closing its socket. Their players stop counting as connected, so the host can
   * reissue the seat, and a closed socket can't keep reading the seat's hand afterwards.
   */
  private dropStaleSockets(): void {
    const now = Date.now()
    for (const ws of this.ctx.getWebSockets()) {
      const { seenAt } = ws.deserializeAttachment() as Attachment
      if (!isStale(lastSeen(seenAt, this.ctx.getWebSocketAutoResponseTimestamp(ws)), now)) continue
      ws.serializeAttachment({ playerId: null, seenAt } satisfies Attachment)
      try {
        ws.close(STALE_CLOSE_CODE, 'No heartbeat')
      } catch {
        // Already closed.
      }
    }
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
