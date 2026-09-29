import { DurableObject } from 'cloudflare:workers'
import type { Seed } from '@canasta/engine'
import { parseClientMessage, type ServerMessage } from './protocol'
import { createRoom, handleMessage, stateMessage, type RoomIds, type RoomState } from './room'

interface Attachment {
  playerId: string | null
}

const ids: RoomIds = {
  newPlayerId: () => crypto.randomUUID(),
  newToken: () => crypto.randomUUID(),
}

export class GameRoom extends DurableObject<Env> {
  private room: RoomState | null = null

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
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

  async fetch(request: Request): Promise<Response> {
    if (!this.room) return new Response('Game not found', { status: 404 })
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected a WebSocket upgrade', { status: 426 })
    }
    const [client, server] = Object.values(new WebSocketPair())
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ playerId: null } satisfies Attachment)
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (!this.room) return
    const parsed = parseClientMessage(raw)
    if (!parsed.ok) return send(ws, parsed.error)

    const { playerId } = ws.deserializeAttachment() as Attachment
    const outcome = handleMessage(this.room, playerId, parsed.message, ids)
    if (outcome.changed) {
      this.room = outcome.state
      await this.ctx.storage.put('room', this.room)
    }
    if (outcome.bindPlayerId) {
      ws.serializeAttachment({ playerId: outcome.bindPlayerId } satisfies Attachment)
    }
    for (const message of outcome.reply) send(ws, message)
    if (outcome.broadcast) this.broadcast()
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    try {
      ws.close(code, reason)
    } catch {
      // Already closed, or a reserved close code that can't be echoed.
    }
    this.broadcast(ws)
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.broadcast(ws)
  }

  private broadcast(except?: WebSocket): void {
    const room = this.room
    if (!room) return
    const sockets = this.ctx.getWebSockets()
    const attachments = new Map(
      sockets.map((ws) => [ws, ws.deserializeAttachment() as Attachment] as const),
    )
    const connectedIds = new Set(
      sockets
        .filter((ws) => ws !== except)
        .map((ws) => attachments.get(ws)?.playerId)
        .filter((playerId): playerId is string => playerId !== null && playerId !== undefined),
    )
    const connected = room.game.players.map((p) => p.id).filter((id) => connectedIds.has(id))
    for (const ws of sockets) {
      if (ws === except) continue
      const { playerId } = attachments.get(ws)!
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
