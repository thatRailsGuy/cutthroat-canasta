import { useSyncExternalStore } from 'react'
import { setting, useSetting } from './settings'
import { loadDisplay, saveDisplay } from './storage'

/** The display options. Each is its own switch, so a player can take any mix of them. */
export interface DisplayOptions {
  /** Everything a size up; the table scrolls instead of fitting the window. */
  large: boolean
  /** Diamonds blue and clubs green, so no two suits share a colour. */
  fourColor: boolean
  /** A plain cloth, ink for the quiet text, thicker outlines. */
  contrast: boolean
  /** No table animations, even when the system doesn't ask for less motion. */
  calm: boolean
}

const display = setting<DisplayOptions>(loadDisplay, saveDisplay)

export const useDisplay = () => useSetting(display)

/** Marks the page's root element with each option that's on, for the CSS to follow. */
function apply(options: DisplayOptions): void {
  const root = document.documentElement.dataset
  const mark = (name: string, on: boolean) => {
    if (on) root[name] = ''
    else delete root[name]
  }
  mark('large', options.large)
  mark('fourColor', options.fourColor)
  mark('contrast', options.contrast)
  mark('calm', options.calm)
}

/** Applies the saved options now, and again whenever they change. Called once at startup. */
export function startDisplay(): void {
  apply(display.current())
  display.subscribe(() => apply(display.current()))
}

const LESS_MOTION = '(prefers-reduced-motion: reduce)'

function systemLessMotion(): boolean {
  return window.matchMedia?.(LESS_MOTION).matches ?? false
}

/** Whether the device asks for less motion, kept up to date. */
export function useSystemLessMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia?.(LESS_MOTION)
      query?.addEventListener('change', onChange)
      return () => query?.removeEventListener('change', onChange)
    },
    systemLessMotion,
    () => false,
  )
}

/** For animations run from code: off when the player or their device asks for less motion. */
export function lessMotion(): boolean {
  return display.current().calm || systemLessMotion()
}
