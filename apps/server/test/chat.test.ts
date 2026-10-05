import { addPlayer, createGame, startGame, type Game } from '@canasta/engine'
import { describe, expect, it } from 'vitest'
import { CHAT_BURST, CHAT_WINDOW_MS, allowSend, appendLine, stampLine } from '../src/chat'
import { CHAT_LOG_SIZE, type ChatLine } from '../src/protocol'

const line = (id: number): ChatLine => ({
  id,
  playerId: 'p1',
  name: 'Ann',
  text: `line ${id}`,
  at: id,
  anchor: { round: null, redeals: 0, after: 0 },
})

function seated(...names: string[]): Game {
  let game = createGame([1, 2, 3, 4])
  names.forEach((name, i) => {
    const result = addPlayer(game, `p${i + 1}`, name)
    if (!result.ok) throw new Error(result.error.message)
    game = result.game
  })
  return game
}

describe('appendLine', () => {
  it('keeps only the newest lines', () => {
    let log: ChatLine[] = []
    for (let id = 1; id <= CHAT_LOG_SIZE + 3; id++) log = appendLine(log, line(id))
    expect(log).toHaveLength(CHAT_LOG_SIZE)
    expect(log[0].id).toBe(4)
    expect(log.at(-1)?.id).toBe(CHAT_LOG_SIZE + 3)
  })
})

describe('allowSend', () => {
  it('allows a burst, refuses one more, and allows again once the window passes', () => {
    let times: number[] = []
    for (let i = 0; i < CHAT_BURST; i++) times = allowSend(times, 1000 + i)!
    expect(times).toHaveLength(CHAT_BURST)
    expect(allowSend(times, 2000)).toBeNull()
    expect(allowSend(times, 1000 + CHAT_WINDOW_MS)).toEqual([...times.slice(1), 11_000])
  })
})

describe('stampLine', () => {
  it('anchors a lobby line to no round', () => {
    expect(stampLine(seated('Ann', 'Bob'), 'p2', 'hi', 7, 123)).toEqual({
      id: 7,
      playerId: 'p2',
      name: 'Bob',
      text: 'hi',
      at: 123,
      anchor: { round: null, redeals: 0, after: 0 },
    })
  })

  it('anchors a line after the deal’s events, and lets a waiting player talk', () => {
    const started = startGame(seated('Ann', 'Bob'))
    if (!started.ok) throw new Error(started.error.message)
    const joined = addPlayer(started.game, 'p3', 'Cat')
    if (!joined.ok) throw new Error(joined.error.message)
    // Cat's arrival is the deal's first event.
    expect(stampLine(joined.game, 'p3', 'hello', 1, 0)?.anchor).toEqual({
      round: 1,
      redeals: 0,
      after: 1,
    })
  })

  it('refuses a player with no seat', () => {
    expect(stampLine(seated('Ann'), 'p9', 'hi', 1, 0)).toBeNull()
  })
})
