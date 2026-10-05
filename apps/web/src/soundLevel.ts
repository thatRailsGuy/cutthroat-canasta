import { useSyncExternalStore } from 'react'
import type { SoundLevel } from './sounds'
import { loadSoundLevel, saveSoundLevel } from './storage'

// One level for the whole page: the button sits in the table, which remounts with each deal,
// and the sounds play from above it, so neither can hold it in state.
let level: SoundLevel | null = null
const listeners = new Set<() => void>()

const current = () => (level ??= loadSoundLevel())

/** How much you hear, kept in the browser. */
export function useSoundLevel(): [SoundLevel, (next: SoundLevel) => void] {
  const value = useSyncExternalStore(subscribe, current, current)
  return [value, setSoundLevel]
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => listeners.delete(onChange)
}

function setSoundLevel(next: SoundLevel): void {
  level = next
  saveSoundLevel(next)
  for (const listener of listeners) listener()
}
