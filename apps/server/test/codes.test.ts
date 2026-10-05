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

  it('leaves out the lookalikes B/8, Z/2 and S/5', () => {
    for (const ch of 'B8Z2S5') expect(CODE_ALPHABET).not.toContain(ch)
  })

  it('uses the random source it is given', () => {
    expect(randomCode(() => 0)).toBe('AAAAAA')
    expect(randomCode((max) => max - 1)).toBe('999999')
  })
})

describe('normalizeCode', () => {
  it('uppercases and trims valid codes', () => {
    expect(normalizeCode(' acd347 ')).toBe('ACD347')
  })

  it('still accepts codes made before the lookalikes were dropped', () => {
    expect(normalizeCode('B8Z2S5')).toBe('B8Z2S5')
  })

  it.each(['', 'ABC23', 'ABC2345', 'ABCD1O', 'ABCDEI', 'ABC-23'])('rejects %j', (input) => {
    expect(normalizeCode(input)).toBeNull()
  })
})

describe('randomSeed', () => {
  it('returns four unsigned 32-bit words', () => {
    const seed = randomSeed()
    expect(seed).toHaveLength(4)
    for (const word of seed) {
      expect(Number.isInteger(word)).toBe(true)
      expect(word).toBeGreaterThanOrEqual(0)
      expect(word).toBeLessThan(2 ** 32)
    }
  })
})
