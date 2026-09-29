import type {
  ClientMessage,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_PING,
  ServerMessage,
} from '@canasta/server/protocol'

// Type-only imports keep server code out of the bundle. Annotating each copy with the server
// constant's literal type makes the typecheck fail if the two ever differ.
const PING: typeof HEARTBEAT_PING = '{"type":"ping"}'
const PING_INTERVAL_MS: typeof HEARTBEAT_INTERVAL_MS = 20_000

export const RECONNECT_BASE_MS = 500
export const RECONNECT_MAX_MS = 15_000
/** Nothing heard for this long (two missed pongs) means the socket is half-open. */
export const SILENCE_LIMIT_MS = PING_INTERVAL_MS * 2 + 5_000

const OPEN = 1

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting'

export interface ConnectionOptions {
  url: string
  /** Runs on every open, including reconnects. Send `join` from here. */
  onOpen(): void
  onMessage(message: ServerMessage): void
  /** `failures` counts closes since the socket was last open. */
  onStatus(status: ConnectionStatus, failures: number): void
  createSocket?: (url: string) => WebSocket
  random?: () => number
}

/** Exponential backoff with jitter: between half and all of min(max, base * 2^attempt). */
export function reconnectDelay(attempt: number, random: () => number = Math.random): number {
  const ceiling = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** attempt)
  return Math.round(ceiling / 2 + (random() * ceiling) / 2)
}

function parse(data: unknown): ServerMessage | null {
  if (typeof data !== 'string') return null
  try {
    return JSON.parse(data) as ServerMessage
  } catch {
    return null
  }
}

/**
 * One game's WebSocket. It reconnects with backoff whenever the socket closes, and pings on an
 * interval. If nothing arrives for SILENCE_LIMIT_MS, it treats the socket as half-open, closes
 * it and reconnects, so the player rejoins with their saved token.
 */
export class GameConnection {
  private readonly options: ConnectionOptions
  private socket: WebSocket | null = null
  private failures = 0
  private stopped = true
  private lastHeard = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined
  private pingTimer: ReturnType<typeof setInterval> | undefined

  constructor(options: ConnectionOptions) {
    this.options = options
  }

  start(): void {
    if (!this.stopped) return
    this.stopped = false
    this.open()
  }

  stop(): void {
    this.stopped = true
    clearTimeout(this.reconnectTimer)
    this.discardSocket()
  }

  isOpen(): boolean {
    return this.socket?.readyState === OPEN
  }

  /** Returns false if the socket isn't open, so the message was not sent. */
  send(message: ClientMessage): boolean {
    if (!this.socket || !this.isOpen()) return false
    this.socket.send(JSON.stringify(message))
    return true
  }

  /** Drops a silent socket, or else pings. Runs on the interval and when the page is shown. */
  check(): void {
    if (!this.socket || !this.isOpen()) return
    if (Date.now() - this.lastHeard > SILENCE_LIMIT_MS) {
      this.discardSocket()
      this.scheduleReconnect()
      return
    }
    this.socket.send(PING)
  }

  private open(): void {
    const socket = (this.options.createSocket ?? ((url) => new WebSocket(url)))(this.options.url)
    this.socket = socket
    socket.onopen = () => {
      this.failures = 0
      this.lastHeard = Date.now()
      this.pingTimer = setInterval(() => this.check(), PING_INTERVAL_MS)
      this.options.onStatus('open', 0)
      this.options.onOpen()
    }
    socket.onmessage = (event: MessageEvent) => {
      this.lastHeard = Date.now()
      const message = parse(event.data)
      if (message && message.type !== 'pong') this.options.onMessage(message)
    }
    // An error event is always followed by a close event, so only close needs handling.
    socket.onclose = () => {
      if (this.socket !== socket) return
      this.discardSocket()
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped) return
    const delay = reconnectDelay(this.failures, this.options.random)
    this.failures += 1
    this.options.onStatus('reconnecting', this.failures)
    this.reconnectTimer = setTimeout(() => this.open(), delay)
  }

  /** Detaches and closes the current socket without triggering a reconnect. */
  private discardSocket(): void {
    clearInterval(this.pingTimer)
    const socket = this.socket
    this.socket = null
    if (!socket) return
    socket.onopen = null
    socket.onmessage = null
    socket.onclose = null
    try {
      socket.close(1000, 'Closing')
    } catch {
      // Already closed.
    }
  }
}
