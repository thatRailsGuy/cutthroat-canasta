import { describe, expect, it } from 'vitest'
import { MAX_PLAYERS, type Seed } from '@canasta/engine'
import { createRoom, handleMessage, type RoomIds, type RoomState } from '../src/room'
import {
  LISTING_TTL_MS,
  MAX_LISTED,
  openTables,
  tableListing,
  type DirectoryEntry,
} from '../src/tables'

const SEED: Seed = [42, 0, 0, 0]

function publicLobby(names: string[]): { state: RoomState; ids: RoomIds } {
  let n = 0
  const ids: RoomIds = {
    newPlayerId: () => `p${++n}`,
    newToken: () => `t${n}`,
    newSeed: () => SEED,
  }
  let state = createRoom('ABCDEF', SEED)
  for (const name of names)
    state = handleMessage(state, null, { type: 'join', name }, ids, []).state
  state = handleMessage(state, 'p1', { type: 'setPublic', public: true }, ids, []).state
  return { state, ids }
}

describe('tableListing', () => {
  it('lists a public lobby whose host is online', () => {
    const { state } = publicLobby(['Ann', 'Bob', 'Cy'])
    expect(tableListing(state, ['p1'])).toEqual({
      code: 'ABCDEF',
      host: 'Ann',
      others: ['Bob', 'Cy'],
      seats: 3,
      maxSeats: MAX_PLAYERS,
      blocked: [],
    })
  })

  it('leaves out a private room', () => {
    const { state } = publicLobby(['Ann'])
    expect(tableListing({ ...state, public: false }, ['p1'])).toBeNull()
  })

  it('leaves out a room whose host is offline', () => {
    const { state } = publicLobby(['Ann', 'Bob'])
    expect(tableListing(state, ['p2'])).toBeNull()
  })

  it('leaves out a started game', () => {
    const { state, ids } = publicLobby(['Ann', 'Bob'])
    const started = handleMessage(state, 'p1', { type: 'start' }, ids, []).state
    expect(tableListing(started, ['p1', 'p2'])).toBeNull()
  })

  it('leaves out a full table', () => {
    const names = Array.from({ length: MAX_PLAYERS }, (_, i) => `P${i}`)
    const { state } = publicLobby(names)
    expect(tableListing(state, ['p1'])).toBeNull()
  })
})

describe('openTables', () => {
  const entry = (code: string, listedAt: number, seenAt = listedAt): DirectoryEntry => ({
    code,
    host: 'Ann',
    others: [],
    seats: 1,
    maxSeats: MAX_PLAYERS,
    blocked: [],
    listedAt,
    seenAt,
  })

  it('puts the newest table first and drops the server-only fields', () => {
    const tables = openTables([entry('OLDONE', 1), entry('NEWONE', 2)], 10, () => false)
    expect(tables.map((t) => t.code)).toEqual(['NEWONE', 'OLDONE'])
    expect(tables[0]).toEqual({ code: 'NEWONE', host: 'Ann', others: [], seats: 1, maxSeats: 8 })
  })

  it('drops a table that stopped reporting in', () => {
    const now = 1_000_000
    const tables = openTables(
      [entry('LIVEXX', 0, now - LISTING_TTL_MS), entry('GONEXX', 0, now - LISTING_TTL_MS - 1)],
      now,
      () => false,
    )
    expect(tables.map((t) => t.code)).toEqual(['LIVEXX'])
  })

  it('leaves out tables that blocked the caller', () => {
    const tables = openTables(
      [entry('KICKED', 1), entry('FINEXX', 2)],
      2,
      (e) => e.code === 'KICKED',
    )
    expect(tables.map((t) => t.code)).toEqual(['FINEXX'])
  })

  it(`shows at most ${MAX_LISTED} tables`, () => {
    const entries = Array.from({ length: MAX_LISTED + 5 }, (_, i) => entry(`T${i}`, i))
    expect(openTables(entries, MAX_LISTED + 5, () => false)).toHaveLength(MAX_LISTED)
  })
})
