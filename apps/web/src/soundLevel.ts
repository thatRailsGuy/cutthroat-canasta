import { useSyncExternalStore } from 'react'
import type { SoundLevel } from './sounds'
import { loadChatSound, loadSoundLevel, saveChatSound, saveSoundLevel } from './storage'

// One setting for the whole page: the button sits in the table, which remounts with each deal,
// and the sounds play from above it, so neither can hold it in state.
interface Setting<T> {
  current(): T
  subscribe(onChange: () => void): () => void
  set(next: T): void
}

function setting<T>(load: () => T, save: (value: T) => void): Setting<T> {
  let value: T | null = null
  const listeners = new Set<() => void>()
  return {
    current: () => (value ??= load()),
    subscribe(onChange) {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    set(next) {
      value = next
      save(next)
      for (const listener of listeners) listener()
    },
  }
}

const soundLevel = setting<SoundLevel>(loadSoundLevel, saveSoundLevel)
const chatSound = setting<boolean>(loadChatSound, saveChatSound)

function useSetting<T>(s: Setting<T>): [T, (next: T) => void] {
  return [useSyncExternalStore(s.subscribe, s.current, s.current), s.set]
}

/** How much you hear, kept in the browser. */
export const useSoundLevel = () => useSetting(soundLevel)

/** Whether a new chat line clinks, kept in the browser. The Off step silences it too. */
export const useChatSound = () => useSetting(chatSound)
