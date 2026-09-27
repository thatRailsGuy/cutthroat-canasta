import { DurableObject } from 'cloudflare:workers'
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
  async init(code: string, seed: number): Promise<boolean> {
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
    if (outcome.bindPlayerId) {
      ws.serializeAttachment({ playerId: outcome.bindPlayerId } satisfies Attachment)
    }
    if (outcome.changed) {
      this.room = outcome.state
      await this.ctx.storage.put('room', this.room)
    }
    for (const message of outcome.reply) send(ws, message)
    if (outcome.changed) this.broadcast()
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    try {
      ws.close(code, reason)
    } catch {
      // Already closed, or a reserved close code that can't be echoed.
    }
  }

  private broadcast(): void {
    const room = this.room
    if (!room) return
    for (const ws of this.ctx.getWebSockets()) {
      const { playerId } = ws.deserializeAttachment() as Attachment
      if (playerId) send(ws, stateMessage(room, playerId))
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
