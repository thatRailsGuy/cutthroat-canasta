const tokenKey = (code: string) => `canasta:token:${code}`
const NAME_KEY = 'canasta:name'

/** localStorage can throw (private mode, blocked storage). The game still works without it. */
function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Ignore: the player can rejoin with a link from the host.
  }
}

export const loadToken = (code: string) => read(tokenKey(code))
export const saveToken = (code: string, token: string) => write(tokenKey(code), token)
export const clearToken = (code: string) => write(tokenKey(code), null)
export const loadName = () => read(NAME_KEY) ?? ''
export const saveName = (name: string) => write(NAME_KEY, name)

/** Reads `#token=…` from a rejoin link. */
export function tokenFromHash(hash: string): string | null {
  const token = new URLSearchParams(hash.replace(/^#/, '')).get('token')
  return token ? token : null
}
