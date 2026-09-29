import { describe, expect, it } from 'vitest'
import { isStale, lastSeen } from '../src/presence'
import { STALE_AFTER_MS } from '../src/protocol'

describe('presence', () => {
  it('uses the later of the last message and the last answered ping', () => {
    expect(lastSeen(1_000, null)).toBe(1_000)
    expect(lastSeen(1_000, new Date(5_000))).toBe(5_000)
    expect(lastSeen(9_000, new Date(5_000))).toBe(9_000)
  })

  it('counts a socket as stale only after STALE_AFTER_MS of silence', () => {
    expect(isStale(0, STALE_AFTER_MS)).toBe(false)
    expect(isStale(0, STALE_AFTER_MS + 1)).toBe(true)
  })
})
