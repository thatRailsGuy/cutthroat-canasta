import { afterEach, describe, expect, it, vi } from 'vitest'
import { gameExists, listTables } from '../src/api'

function stubFetch(result: Response | Error) {
  const fetch = vi.fn(async () => {
    if (result instanceof Error) throw result
    return result
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('gameExists', () => {
  it('is true when the server finds the game', async () => {
    const fetch = stubFetch(Response.json({ code: 'ABCDEF' }))
    expect(await gameExists('ABCDEF')).toBe(true)
    expect(fetch).toHaveBeenCalledWith('/api/games/ABCDEF')
  })

  it('is false when the server has no such game', async () => {
    stubFetch(new Response('Not found', { status: 404 }))
    expect(await gameExists('QQQQQQ')).toBe(false)
  })

  it('is null for any other status', async () => {
    stubFetch(new Response('Bad gateway', { status: 502 }))
    expect(await gameExists('ABCDEF')).toBeNull()
  })

  it('is null when the request fails', async () => {
    stubFetch(new TypeError('Failed to fetch'))
    expect(await gameExists('ABCDEF')).toBeNull()
  })
})

describe('listTables', () => {
  it('returns the open tables', async () => {
    const table = { code: 'ABCDEF', host: 'Ann', others: [], seats: 1, maxSeats: 8 }
    const fetch = stubFetch(Response.json({ tables: [table] }))
    expect(await listTables()).toEqual([table])
    expect(fetch).toHaveBeenCalledWith('/api/tables')
  })

  it('is null when the server or the network fails', async () => {
    stubFetch(new Response('Bad gateway', { status: 502 }))
    expect(await listTables()).toBeNull()
    stubFetch(new TypeError('Failed to fetch'))
    expect(await listTables()).toBeNull()
  })
})
