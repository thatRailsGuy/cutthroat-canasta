import { describe, expect, it, vi } from 'vitest'
import { holdSeats, type Seat, type SeatOptions } from '../src/dev/seats'

class FakeSocket {
  readyState = 0
  sent: unknown[] = []
  closed = false
  onopen: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onclose: (() => void) | null = null

  send(data: string) {
    this.sent.push(JSON.parse(data))
  }
  close() {
    this.closed = true
    this.readyState = 3
  }
  accept() {
    this.readyState = 1
    this.onopen?.()
  }
  receive(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) })
  }
}

function setup(overrides: Partial<SeatOptions> = {}) {
  const sockets: FakeSocket[] = []
  let seats: Seat[] = []
  const options: SeatOptions = {
    code: 'ACDEFG',
    players: 3,
    deal: false,
    isPublic: false,
    onSeats: (s) => (seats = s),
    onError: vi.fn(),
    createSocket: () => {
      const socket = new FakeSocket()
      sockets.push(socket)
      return socket as unknown as WebSocket
    },
    ...overrides,
  }
  const held = holdSeats(options)
  /** The server's side: accept the newest socket and seat it. */
  const seatNext = () => {
    const socket = sockets.at(-1)!
    socket.accept()
    socket.receive({
      type: 'joined',
      code: 'ACDEFG',
      playerId: `p${sockets.length}`,
      token: `t${sockets.length}`,
    })
  }
  return { held, options, sockets, seats: () => seats, seatNext }
}

describe('holdSeats', () => {
  it('joins the players one after another, in seat order', () => {
    const { sockets, seats, seatNext } = setup()
    expect(sockets).toHaveLength(1)
    seatNext()
    expect(sockets).toHaveLength(2)
    seatNext()
    seatNext()
    expect(sockets.map((s) => s.sent[0])).toEqual([
      { type: 'join', name: 'Ann' },
      { type: 'join', name: 'Bob' },
      { type: 'join', name: 'Cat' },
    ])
    expect(seats().map((s) => [s.name, s.token, s.held])).toEqual([
      ['Ann', 't1', true],
      ['Bob', 't2', true],
      ['Cat', 't3', true],
    ])
  })

  it('has the host start the game once every seat is taken', () => {
    const { sockets, seatNext } = setup({ players: 2, deal: true, isPublic: true })
    seatNext()
    expect(sockets[0].sent).toEqual([{ type: 'join', name: 'Ann' }])
    seatNext()
    expect(sockets[0].sent.at(-1)).toEqual({ type: 'start' })
    expect(sockets[0].sent).not.toContainEqual({ type: 'setPublic', public: true })
  })

  it('has the host make the lobby public', () => {
    const { sockets, seatNext } = setup({ players: 2, isPublic: true })
    seatNext()
    seatNext()
    expect(sockets[0].sent.at(-1)).toEqual({ type: 'setPublic', public: true })
  })

  it('rejoins a dropped seat with its token', () => {
    const { sockets, seatNext } = setup({ players: 2 })
    seatNext()
    seatNext()
    sockets[1].readyState = 3
    sockets[1].onclose?.()
    return vi.waitFor(() => {
      const again = sockets.at(-1)!
      expect(again).not.toBe(sockets[1])
      again.accept()
      expect(again.sent[0]).toEqual({ type: 'join', name: 'Bob', token: 't2' })
    })
  })

  it('lets go of a seat for another tab, and of all of them on stop', () => {
    const { held, sockets, seats, seatNext } = setup({ players: 2 })
    seatNext()
    seatNext()
    held.letGo(0)
    expect(sockets[0].closed).toBe(true)
    expect(seats()[0].held).toBe(false)
    expect(sockets[1].closed).toBe(false)
    held.stop()
    expect(sockets[1].closed).toBe(true)
  })
})
