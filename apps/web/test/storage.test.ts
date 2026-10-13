import { afterEach, describe, expect, it } from 'vitest'
import { clearToken, loadToken, saveLinkToken, saveToken } from '../src/storage'

describe('game tokens', () => {
  afterEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  /** What a new tab, opened by typing the game's address, would join with. */
  const deviceToken = () => localStorage.getItem('canasta:token:ACDEFG')

  it("keeps this tab's token over one another tab saved later", () => {
    saveToken('ACDEFG', 'ann', 'p1')
    // Another tab sits in Bob's seat of the same game.
    localStorage.setItem('canasta:token:ACDEFG', 'bob')
    expect(loadToken('ACDEFG')).toBe('ann')
  })

  it('falls back to the last saved token in a new tab', () => {
    localStorage.setItem('canasta:token:ACDEFG', 'bob')
    expect(loadToken('ACDEFG')).toBe('bob')
  })

  it('clears both copies', () => {
    saveToken('ACDEFG', 'ann', 'p1')
    clearToken('ACDEFG')
    expect(loadToken('ACDEFG')).toBeNull()
  })

  it("keeps the device's seat when a rejoin link for someone else's seat opens", () => {
    saveToken('ACDEFG', 'ann', 'p1')
    // A new tab, opened from Bob's rejoin link.
    sessionStorage.clear()
    saveLinkToken('ACDEFG', 'bob')
    expect(loadToken('ACDEFG')).toBe('bob')
    saveToken('ACDEFG', 'bob', 'p2')
    expect(loadToken('ACDEFG')).toBe('bob')
    expect(deviceToken()).toBe('ann')
  })

  it("takes a rejoin link for the device's own seat as the device's seat", () => {
    saveToken('ACDEFG', 'ann-old', 'p1')
    sessionStorage.clear()
    // The host reissued Ann's seat, and Ann opens the new link.
    saveLinkToken('ACDEFG', 'ann-new')
    saveToken('ACDEFG', 'ann-new', 'p1')
    expect(deviceToken()).toBe('ann-new')
  })

  it('replaces a device token saved before seats were recorded', () => {
    localStorage.setItem('canasta:token:ACDEFG', 'ann')
    saveLinkToken('ACDEFG', 'bob')
    saveToken('ACDEFG', 'bob', 'p2')
    expect(deviceToken()).toBe('bob')
  })

  it("leaves the device's seat alone when a link tab's token is cleared", () => {
    saveToken('ACDEFG', 'ann', 'p1')
    sessionStorage.clear()
    saveLinkToken('ACDEFG', 'bob')
    clearToken('ACDEFG')
    expect(sessionStorage.getItem('canasta:token:ACDEFG')).toBeNull()
    expect(loadToken('ACDEFG')).toBe('ann')
  })
})
