import { useSyncExternalStore } from 'react'

/**
 * One value for the whole page, kept in the browser. A setting's controls and the things it
 * changes sit in different parts of the page (the table remounts with each deal), so neither
 * can hold it in React state.
 */
export interface Setting<T> {
  current(): T
  subscribe(onChange: () => void): () => void
  set(next: T): void
}

export function setting<T>(load: () => T, save: (value: T) => void): Setting<T> {
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

export function useSetting<T>(s: Setting<T>): [T, (next: T) => void] {
  return [useSyncExternalStore(s.subscribe, s.current, s.current), s.set]
}
