import type { DisplayOptions } from './display'
import { DEFAULT_SOUND_LEVEL, type SoundLevel } from './sounds'

const tokenKey = (code: string) => `canasta:token:${code}`
const NAME_KEY = 'canasta:name'
const HAND_LAYOUT_KEY = 'canasta:handLayout'
const SOUND_LEVEL_KEY = 'canasta:soundLevel'
const CHAT_SOUND_KEY = 'canasta:chatSound'
const DISPLAY_KEY = 'canasta:display'

const local = () => localStorage
const session = () => sessionStorage

/** Storage can throw (private mode, blocked storage). The game still works without it. */
function read(key: string, store: () => Storage = local): string | null {
  try {
    return store().getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null, store: () => Storage = local): void {
  try {
    if (value === null) store().removeItem(key)
    else store().setItem(key, value)
  } catch {
    // Ignore: the player can rejoin with a link from the host.
  }
}

/**
 * Each tab keeps its own copy of a game's token, so two seats of one game open in two tabs
 * don't take each other's seat on a reconnect or a reload. localStorage keeps the latest one,
 * for a new tab.
 */
export const loadToken = (code: string) => read(tokenKey(code), session) ?? read(tokenKey(code))
export function saveToken(code: string, token: string): void {
  write(tokenKey(code), token, session)
  write(tokenKey(code), token)
}
export function clearToken(code: string): void {
  write(tokenKey(code), null, session)
  write(tokenKey(code), null)
}
export const loadName = () => read(NAME_KEY) ?? ''
export const saveName = (name: string) => write(NAME_KEY, name)
export function loadHandLayout(): 'spread' | 'line' | null {
  const layout = read(HAND_LAYOUT_KEY)
  return layout === 'spread' || layout === 'line' ? layout : null
}
export const saveHandLayout = (layout: 'spread' | 'line') => write(HAND_LAYOUT_KEY, layout)
export function loadSoundLevel(): SoundLevel {
  const level = Number(read(SOUND_LEVEL_KEY) ?? NaN)
  return level === 0 || level === 1 || level === 2 || level === 3 ? level : DEFAULT_SOUND_LEVEL
}
export const saveSoundLevel = (level: SoundLevel) => write(SOUND_LEVEL_KEY, String(level))
/** The chat clink is on unless the player turned it off. */
export const loadChatSound = () => read(CHAT_SOUND_KEY) !== 'off'
export const saveChatSound = (on: boolean) => write(CHAT_SOUND_KEY, on ? null : 'off')

/** Reads `#token=…` from a rejoin link. */
export function tokenFromHash(hash: string): string | null {
  const token = new URLSearchParams(hash.replace(/^#/, '')).get('token')
  return token ? token : null
}

/** The display options. Each is off unless saved as on, so a damaged value turns them all off. */
export function loadDisplay(): DisplayOptions {
  let saved: Partial<Record<keyof DisplayOptions, unknown>> = {}
  try {
    saved = JSON.parse(read(DISPLAY_KEY) ?? '{}') ?? {}
  } catch {
    // Unreadable: everything off.
  }
  const flag = (key: keyof DisplayOptions) => saved[key] === true
  return {
    large: flag('large'),
    fourColor: flag('fourColor'),
    contrast: flag('contrast'),
    calm: flag('calm'),
  }
}
export const saveDisplay = (options: DisplayOptions) => write(DISPLAY_KEY, JSON.stringify(options))
