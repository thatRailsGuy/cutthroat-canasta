import { afterEach, describe, expect, it, vi } from 'vitest'
import { newJoinId } from '../src/useGame'

describe('newJoinId', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('works without crypto.randomUUID, as over plain http on a LAN', () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) })
    const id = newJoinId()
    expect(id).toMatch(/^[0-9a-f]{32}$/)
    expect(newJoinId()).not.toBe(id)
  })
})
