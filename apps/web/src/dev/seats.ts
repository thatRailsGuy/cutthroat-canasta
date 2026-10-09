import { MAX_PLAYERS } from '@canasta/engine'
import type { ClientMessage } from '@canasta/server/protocol'
import { socketUrl } from '../api'
import { GameConnection } from '../connection'

/** The made-up players, in seat order. The first is host. */
export const SEAT_NAMES = ['Ann', 'Bob', 'Cat', 'Dee', 'Eve', 'Fay', 'Gus', 'Hal'].slice(
  0,
  MAX_PLAYERS,
)

export interface Seat {
  name: string
  /** Null until the seat's join is answered. */
  token: string | null
  /** True while this page holds the seat online; false once another tab has it. */
  held: boolean
}

export interface SeatOptions {
  code: string
  players: number
  /** Start the game once every seat is taken. */
  deal: boolean
  /** List the table on the home page. Only in the lobby, so ignored with `deal`. */
  isPublic: boolean
  onSeats(seats: Seat[]): void
  onError(message: string): void
  createSocket?: (url: string) => WebSocket
}

export interface HeldSeats {
  /** Closes the seat's socket, so the tab its rejoin link opens has it to itself. */
  letGo(index: number): void
  /** Closes every socket this page still holds. */
  stop(): void
}

/**
 * Dev only: fills a new game's seats from this page, one socket per player, joined one after
 * another so the seat order is the name order. Each socket stays open, and rejoins with its
 * token after a drop, until the page lets go of it. Once every seat is taken, the host makes
 * the table public or starts the game.
 */
export function holdSeats(options: SeatOptions): HeldSeats {
  const seats: Seat[] = SEAT_NAMES.slice(0, options.players).map((name) => ({
    name,
    token: null,
    held: true,
  }))
  const connections: GameConnection[] = []
  const update = () => options.onSeats(seats.map((seat) => ({ ...seat })))

  const sit = (index: number) => {
    const seat = seats[index]
    const connection = new GameConnection({
      url: socketUrl(options.code),
      createSocket: options.createSocket,
      onOpen: () => {
        const join: ClientMessage = seat.token
          ? { type: 'join', name: seat.name, token: seat.token }
          : { type: 'join', name: seat.name }
        connection.send(join)
      },
      onStatus: () => {},
      onMessage: (message) => {
        if (message.type === 'joined') {
          const first = seat.token === null
          seat.token = message.token
          if (first) next(index)
          update()
        } else if (message.type === 'error') {
          options.onError(`${seat.name}: ${message.message}`)
        } else if (message.type === 'removed') {
          connection.stop()
          seat.held = false
          options.onError(`${seat.name} is out of the game (${message.reason}).`)
          update()
        }
      },
    })
    connections[index] = connection
    connection.start()
  }

  const next = (index: number) => {
    if (index + 1 < seats.length) {
      sit(index + 1)
      return
    }
    const host = connections[0]
    if (options.deal) host.send({ type: 'start' })
    else if (options.isPublic) host.send({ type: 'setPublic', public: true })
  }

  sit(0)
  update()
  return {
    letGo(index) {
      connections[index]?.stop()
      seats[index].held = false
      update()
    },
    stop() {
      for (const connection of connections) connection.stop()
    },
  }
}
