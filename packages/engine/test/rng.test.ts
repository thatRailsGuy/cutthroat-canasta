import { describe, expect, it } from 'vitest'
import { createRng, shuffle } from '../src/rng'

describe('createRng', () => {
  it('returns values in [0, 1)', () => {
    const rng = createRng(123)
    for (let i = 0; i < 1000; i++) {
      const value = rng()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('repeats the same sequence for the same seed', () => {
    const a = createRng(7)
    const b = createRng(7)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
})

describe('shuffle', () => {
  const items = Array.from({ length: 50 }, (_, i) => i)

  it('keeps every item exactly once', () => {
    expect([...shuffle(items, createRng(1))].sort((x, y) => x - y)).toEqual(items)
  })

  it('does not modify its input', () => {
    const copy = [...items]
    shuffle(items, createRng(1))
    expect(items).toEqual(copy)
  })

  it('is deterministic per seed and differs across seeds', () => {
    expect(shuffle(items, createRng(5))).toEqual(shuffle(items, createRng(5)))
    expect(shuffle(items, createRng(5))).not.toEqual(shuffle(items, createRng(6)))
  })
})
