import { describe, expect, it } from 'vitest'
import { createRng, shuffle, type Seed } from '../src/rng'
import { seedOf } from './fixtures'

describe('createRng', () => {
  it('returns values in [0, 1)', () => {
    const rng = createRng(seedOf(123))
    for (let i = 0; i < 1000; i++) {
      const value = rng()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('repeats the same sequence for the same seed', () => {
    const a = createRng(seedOf(7))
    const b = createRng(seedOf(7))
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it('uses every word of the seed', () => {
    const base: Seed = [1, 2, 3, 4]
    const first = createRng(base)()
    for (let word = 0; word < 4; word++) {
      const changed = [...base] as Seed
      changed[word] ^= 1
      expect(createRng(changed)()).not.toBe(first)
    }
  })

  it('spreads values evenly across ten buckets', () => {
    const rng = createRng(seedOf(99))
    const buckets = new Array<number>(10).fill(0)
    for (let i = 0; i < 10_000; i++) buckets[Math.floor(rng() * 10)]++
    for (const count of buckets) {
      expect(count).toBeGreaterThan(900)
      expect(count).toBeLessThan(1100)
    }
  })
})

describe('shuffle', () => {
  const items = Array.from({ length: 50 }, (_, i) => i)

  it('keeps every item exactly once', () => {
    expect([...shuffle(items, createRng(seedOf(1)))].sort((x, y) => x - y)).toEqual(items)
  })

  it('does not modify its input', () => {
    const copy = [...items]
    shuffle(items, createRng(seedOf(1)))
    expect(items).toEqual(copy)
  })

  it('is deterministic per seed and differs across seeds', () => {
    expect(shuffle(items, createRng(seedOf(5)))).toEqual(shuffle(items, createRng(seedOf(5))))
    expect(shuffle(items, createRng(seedOf(5)))).not.toEqual(shuffle(items, createRng(seedOf(6))))
  })

  it('handles empty and single-item inputs', () => {
    expect(shuffle([], createRng(seedOf(1)))).toEqual([])
    expect(shuffle(['a'], createRng(seedOf(1)))).toEqual(['a'])
  })
})
