import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  GameConnection,
  RECONNECT_MAX_MS,
  SILENCE_LIMIT_MS,
  reconnectDelay,
  type ConnectionOptions,
} from '../src/connection'

class FakeSocket {
  readyState = 0
  sent: string[] = []
  closed = false
  onopen: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onclose: (() => void) | null = null

  constructor(readonly url: string) {}

  send(data: string) {
    this.sent.push(data)
  }
  close() {
    this.closed = true
    this.readyState = 3
  }
  /** Test helpers: what the server or the network does. */
  accept() {
    this.readyState = 1
    this.onopen?.()
  }
  receive(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) })
  }
  drop() {
    this.readyState = 3
    this.onclose?.()
  }
}

function setup(overrides: Partial<ConnectionOptions> = {}) {
  const sockets: FakeSocket[] = []
  const options = {
    url: 'ws://test/api/games/ABCDEF/ws',
    onOpen: vi.fn(),
    onMessage: vi.fn(),
    onStatus: vi.fn(),
    createSocket: (url: string) => {
      const socket = new FakeSocket(url)
      sockets.push(socket)
      return socket as unknown as WebSocket
    },
    random: () => 1,
    ...overrides,
  }
  const connection = new GameConnection(options)
  connection.start()
  return { connection, options, sockets, latest: () => sockets.at(-1)! }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('reconnectDelay', () => {
  it('doubles from 500 ms up to the cap, with up to half taken off by jitter', () => {
    expect(reconnectDelay(0, () => 1)).toBe(500)
    expect(reconnectDelay(0, () => 0)).toBe(250)
    expect(reconnectDelay(3, () => 1)).toBe(4000)
    expect(reconnectDelay(20, () => 1)).toBe(RECONNECT_MAX_MS)
  })
})

describe('GameConnection', () => {
  it('reports the open, lets the caller join, and forwards messages', () => {
    const { connection, options, latest } = setup()
    expect(connection.send({ type: 'start' })).toBe(false)
    latest().accept()
    expect(options.onStatus).toHaveBeenLastCalledWith('open', 0)
    expect(options.onOpen).toHaveBeenCalledTimes(1)
    expect(connection.send({ type: 'join', name: 'Ann' })).toBe(true)
    expect(latest().sent).toEqual(['{"type":"join","name":"Ann"}'])
    latest().receive({ type: 'error', code: 'NOT_HOST', message: 'Only the host can do that.' })
    expect(options.onMessage).toHaveBeenCalledWith({
      type: 'error',
      code: 'NOT_HOST',
      message: 'Only the host can do that.',
    })
  })

  it('swallows pongs and ignores frames that are not JSON', () => {
    const { options, latest } = setup()
    latest().accept()
    latest().receive({ type: 'pong' })
    latest().onmessage?.({ data: 'garbage' })
    expect(options.onMessage).not.toHaveBeenCalled()
  })

  it('reconnects with backoff after a close and joins again', () => {
    const { options, sockets, latest } = setup()
    latest().accept()
    latest().drop()
    expect(options.onStatus).toHaveBeenLastCalledWith('reconnecting', 1)
    vi.advanceTimersByTime(499)
    expect(sockets).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(sockets).toHaveLength(2)

    latest().drop()
    expect(options.onStatus).toHaveBeenLastCalledWith('reconnecting', 2)
    vi.advanceTimersByTime(1000)
    expect(sockets).toHaveLength(3)
    latest().accept()
    expect(options.onOpen).toHaveBeenCalledTimes(2)
    expect(options.onStatus).toHaveBeenLastCalledWith('open', 0)
  })

  it('pings on an interval while messages keep arriving', () => {
    const { latest } = setup()
    latest().accept()
    vi.advanceTimersByTime(20_000)
    expect(latest().sent).toEqual(['{"type":"ping"}'])
    latest().receive({ type: 'pong' })
    vi.advanceTimersByTime(20_000)
    expect(latest().sent).toHaveLength(2)
  })

  it('closes a silent, half-open socket and reconnects', () => {
    const { sockets, latest } = setup()
    latest().accept()
    const first = latest()
    vi.advanceTimersByTime(SILENCE_LIMIT_MS + 20_000)
    expect(first.closed).toBe(true)
    vi.advanceTimersByTime(RECONNECT_MAX_MS)
    expect(sockets.length).toBeGreaterThan(1)
  })

  it('stops for good when asked', () => {
    const { connection, sockets, latest } = setup()
    latest().accept()
    connection.stop()
    expect(latest().closed).toBe(true)
    vi.advanceTimersByTime(60_000)
    expect(sockets).toHaveLength(1)
  })
})
