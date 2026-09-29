export type Rng = () => number

/** Four u32 words: 128 bits of PRNG state, too many to brute-force from a dealt hand. */
export type Seed = [number, number, number, number]

/** sfc32: small, fast, and deterministic, with 128 bits of state. Not a cryptographic RNG. */
export function createRng(seed: Seed): Rng {
  let a = seed[0] | 0
  let b = seed[1] | 0
  let c = seed[2] | 0
  let d = seed[3] | 0
  const next = () => {
    const t = (((a + b) | 0) + d) | 0
    d = (d + 1) | 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) | 0
    c = ((c << 21) | (c >>> 11)) + t
    c |= 0
    return (t >>> 0) / 4294967296
  }
  // Discard early outputs so that seeds differing in one bit diverge.
  for (let i = 0; i < 12; i++) next()
  return next
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
