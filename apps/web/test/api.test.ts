import { afterEach, describe, expect, it, vi } from 'vitest'
import { gameExists } from '../src/api'

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
