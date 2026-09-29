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
/**
 * A ping with no reply (a pong or any other message) for this long means the socket is
 * half-open. Liveness is measured from the outstanding ping, not from the last message, because
 * background tabs may run the ping interval only about once a minute.
 */
export const PONG_TIMEOUT_MS = 10_000

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
 * One game's WebSocket. It reconnects with backoff whenever the socket closes, and pings every
 * PING_INTERVAL_MS while no ping is waiting for an answer. If a ping goes unanswered for
 * PONG_TIMEOUT_MS, it treats the socket as half-open, closes it and reconnects, so the player
 * rejoins with their saved token.
 */
export class GameConnection {
  private readonly options: ConnectionOptions
  private socket: WebSocket | null = null
  private failures = 0
  private stopped = true
  /** When the ping that is waiting for an answer was sent, or null if none is waiting. */
  private pingSentAt: number | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined
  private pingTimer: ReturnType<typeof setInterval> | undefined
  private pongTimer: ReturnType<typeof setTimeout> | undefined

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

  /**
   * Pings at once and drops the socket if no answer arrives within PONG_TIMEOUT_MS. Run it when
   * the page is shown, so a socket that died while the tab was hidden is found quickly. If a
   * ping is already waiting, it does nothing: that ping's timer decides, so showing the page
   * again and again can't put off the drop.
   */
  check(): void {
    if (!this.isOpen() || this.pingSentAt !== null) return
    this.ping()
  }

  /** The interval's tick: ping, unless a ping is still waiting for its answer. */
  private tick(): void {
    if (!this.isOpen()) return
    if (this.pingSentAt === null) this.ping()
    // A backstop in case the pong timer was throttled more than the interval.
    else if (Date.now() - this.pingSentAt > PONG_TIMEOUT_MS) this.dropDeadSocket()
  }

  private ping(): void {
    this.pingSentAt = Date.now()
    this.socket?.send(PING)
    clearTimeout(this.pongTimer)
    this.pongTimer = setTimeout(() => this.dropDeadSocket(), PONG_TIMEOUT_MS)
  }

  /** Forgets the outstanding ping: any message answers it, and a discarded socket needs none. */
  private clearPing(): void {
    this.pingSentAt = null
    clearTimeout(this.pongTimer)
  }

  private dropDeadSocket(): void {
    this.discardSocket()
    this.scheduleReconnect()
  }

  private open(): void {
    const socket = (this.options.createSocket ?? ((url) => new WebSocket(url)))(this.options.url)
    this.socket = socket
    socket.onopen = () => {
      this.failures = 0
      this.pingTimer = setInterval(() => this.tick(), PING_INTERVAL_MS)
      this.options.onStatus('open', 0)
      this.options.onOpen()
    }
    socket.onmessage = (event: MessageEvent) => {
      this.clearPing()
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
    this.clearPing()
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
