import { describe, expect, it } from 'vitest'
import { CODE_ALPHABET, normalizeCode, randomCode, randomSeed } from '../src/codes'

describe('randomCode', () => {
  it('makes 6 characters from the unambiguous alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const code = randomCode()
      expect(code).toHaveLength(6)
      expect([...code].every((ch) => CODE_ALPHABET.includes(ch))).toBe(true)
    }
  })

  it('uses the random source it is given', () => {
    expect(randomCode(() => 0)).toBe('AAAAAA')
    expect(randomCode((max) => max - 1)).toBe('999999')
  })
})

describe('normalizeCode', () => {
  it('uppercases and trims valid codes', () => {
    expect(normalizeCode(' abc234 ')).toBe('ABC234')
  })

  it.each(['', 'ABC23', 'ABC2345', 'ABCD1O', 'ABCDEI', 'ABC-23'])('rejects %j', (input) => {
    expect(normalizeCode(input)).toBeNull()
  })
})

describe('randomSeed', () => {
  it('returns an unsigned 32-bit integer', () => {
    const seed = randomSeed()
    expect(Number.isInteger(seed)).toBe(true)
    expect(seed).toBeGreaterThanOrEqual(0)
    expect(seed).toBeLessThan(2 ** 32)
  })
})
