/**
 * A key for the network a player connects from, so a kick can block it. It's a hash of the IP
 * address salted with the game code, so a room's storage holds no addresses, and the same
 * network gets a different key in each room.
 */
export async function addressKey(code: string, ip: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${code}:${ip}`))
  return btoa(String.fromCharCode(...new Uint8Array(digest).slice(0, 16)))
}

/** The caller's IP address. Cloudflare sets the header; local tests and dev may not. */
export function clientIp(request: Request): string | null {
  return request.headers.get('CF-Connecting-IP')
}
