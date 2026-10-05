import type { Seed } from '@canasta/engine'

/**
 * No I, L, O, 0 or 1, and none of the lookalike pairs B/8, Z/2 and S/5, so codes are easy to
 * read aloud and type.
 */
export const CODE_ALPHABET = 'ACDEFGHJKMNPQRTUVWXY34679'
export const CODE_LENGTH = 6

/** Codes made before the lookalikes were dropped still name live rooms, so they still parse. */
const ACCEPTED_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_PATTERN = new RegExp(`^[${ACCEPTED_ALPHABET}]{${CODE_LENGTH}}$`)

export type RandomInt = (maxExclusive: number) => number

/** Modulo bias is negligible for an alphabet of 25 against 2^32. */
export function cryptoRandomInt(maxExclusive: number): number {
  const [value] = crypto.getRandomValues(new Uint32Array(1))
  return value % maxExclusive
}

export function randomCode(randomInt: RandomInt = cryptoRandomInt): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
  return code
}

export function normalizeCode(input: string): string | null {
  const code = input.trim().toUpperCase()
  return CODE_PATTERN.test(code) ? code : null
}

export function randomSeed(): Seed {
  const [a, b, c, d] = crypto.getRandomValues(new Uint32Array(4))
  return [a, b, c, d]
}
