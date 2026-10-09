import { afterEach, describe, expect, it } from 'vitest'
import { clearToken, loadToken, saveToken } from '../src/storage'

describe('game tokens', () => {
  afterEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it("keeps this tab's token over one another tab saved later", () => {
    saveToken('ACDEFG', 'ann')
    // Another tab sits in Bob's seat of the same game.
    localStorage.setItem('canasta:token:ACDEFG', 'bob')
    expect(loadToken('ACDEFG')).toBe('ann')
  })

  it('falls back to the last saved token in a new tab', () => {
    localStorage.setItem('canasta:token:ACDEFG', 'bob')
    expect(loadToken('ACDEFG')).toBe('bob')
  })

  it('clears both copies', () => {
    saveToken('ACDEFG', 'ann')
    clearToken('ACDEFG')
    expect(loadToken('ACDEFG')).toBeNull()
  })
})
