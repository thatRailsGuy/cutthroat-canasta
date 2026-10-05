/**
 * Game codes use the server's accepted alphabet: no I, L, O, 0 or 1. New codes also leave out
 * B, 8, Z, 2, S and 5, but older codes with them still name live rooms.
 */
const CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/

export function normalizeCode(input: string): string | null {
  const code = input.trim().toUpperCase()
  return CODE_PATTERN.test(code) ? code : null
}

export async function createGame(): Promise<string> {
  const response = await fetch('/api/games', { method: 'POST' })
  if (response.status !== 201) throw new Error(`Could not create a game (${response.status}).`)
  const { code } = (await response.json()) as { code: string }
  return code
}

/**
 * Asks the server whether a game exists: true on 200, false on 404, and null when the answer
 * is unknown (a network error or any other status), so the caller can still try to connect.
 */
export async function gameExists(code: string): Promise<boolean | null> {
  try {
    const response = await fetch(`/api/games/${encodeURIComponent(code)}`)
    if (response.status === 200) return true
    if (response.status === 404) return false
    return null
  } catch {
    return null
  }
}

export function socketUrl(code: string, location: Location = window.location): string {
  const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${scheme}//${location.host}/api/games/${code}/ws`
}

export function rejoinLink(
  code: string,
  token: string,
  location: Location = window.location,
): string {
  return `${location.origin}/g/${code}#token=${encodeURIComponent(token)}`
}
