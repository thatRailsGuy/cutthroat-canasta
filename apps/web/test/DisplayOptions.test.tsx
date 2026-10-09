import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { DisplayButton, DisplaySwitches } from '../src/components/DisplayOptions'
import { lessMotion, startDisplay } from '../src/display'
import { loadDisplay } from '../src/storage'

const root = document.documentElement

/** Fakes the device's reduced-motion setting. */
function systemLessMotion(on: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: on && query.includes('reduced-motion'),
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

beforeAll(() => startDisplay())

afterEach(async () => {
  // Turn every switch back off, so the shared setting doesn't leak between tests.
  vi.unstubAllGlobals()
  localStorage.clear()
  render(<DisplaySwitches />)
  for (const toggle of screen.getAllByRole('switch')) {
    if (toggle.getAttribute('aria-checked') === 'true') await userEvent.click(toggle)
  }
})

describe('DisplaySwitches', () => {
  it('turns each option on by itself, marks the page and keeps it in the browser', async () => {
    systemLessMotion(false)
    render(<DisplaySwitches />)
    await userEvent.click(screen.getByRole('switch', { name: 'High contrast' }))
    expect(root.dataset.contrast).toBe('')
    expect(root.dataset.large).toBeUndefined()
    expect(loadDisplay()).toEqual({ large: false, fourColor: false, contrast: true, calm: false })

    await userEvent.click(screen.getByRole('switch', { name: 'Four-color suits' }))
    expect(root.dataset.fourColor).toBe('')
    expect(screen.getByRole('switch', { name: 'High contrast' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('shows Fewer animations on and locked when the device asks for less motion', async () => {
    systemLessMotion(true)
    render(<DisplaySwitches />)
    const calm = screen.getByRole('switch', { name: 'Fewer animations' })
    expect(calm).toHaveAttribute('aria-checked', 'true')
    expect(calm).toHaveAttribute('aria-disabled', 'true')
    expect(calm).toHaveAccessibleDescription('On, because your device asks for less motion.')
    await userEvent.click(calm)
    expect(loadDisplay().calm).toBe(false)
  })

  it('lets code ask whether to animate', async () => {
    systemLessMotion(false)
    expect(lessMotion()).toBe(false)
    render(<DisplaySwitches />)
    await userEvent.click(screen.getByRole('switch', { name: 'Fewer animations' }))
    expect(lessMotion()).toBe(true)
  })
})

describe('DisplayButton', () => {
  it('opens to the first switch, and Escape closes it back to the button', async () => {
    systemLessMotion(false)
    render(<DisplayButton />)
    const button = screen.getByRole('button', { name: 'Display options' })
    await userEvent.click(button)
    expect(screen.getByRole('switch', { name: 'Larger cards and text' })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(button).toHaveFocus()
  })
})

describe('loadDisplay', () => {
  it('turns everything off for a damaged value', () => {
    localStorage.setItem('canasta:display', '{not json')
    expect(loadDisplay()).toEqual({ large: false, fourColor: false, contrast: false, calm: false })
  })
})
