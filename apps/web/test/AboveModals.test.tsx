import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useCallback, useState } from 'react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { RulesDrawer } from '../src/components/RulesDrawer'
import { SideSheet } from '../src/components/SideSheet'
import { Toasts } from '../src/components/Toasts'
import type { Toast } from '../src/gameState'
import { ConnectionBanner } from '../src/pages/GamePage'
import { RulesDrawerContext, type DrawerRequest } from '../src/rules/drawer'
import type { PageSection } from '../src/rules/sections'

const TOAST: Toast = { id: 1, message: 'A meld needs at least 2 natural cards.', section: 'melds' }

/** A game page in small: the banner, a toast, the side sheet and the rules drawer. */
function Page({ sheet = false, onRules }: { sheet?: boolean; onRules?: (s: PageSection) => void }) {
  const [sideOpen, setSideOpen] = useState(sheet)
  const [drawer, setDrawer] = useState<DrawerRequest | null>(null)
  const [toasts, setToasts] = useState([TOAST])
  const openRules = useCallback(
    (section: PageSection) => {
      onRules?.(section)
      setDrawer((d) => ({ section, id: (d?.id ?? 0) + 1 }))
    },
    [onRules],
  )
  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), [])
  return (
    <MemoryRouter>
      <RulesDrawerContext.Provider value={openRules}>
        <ConnectionBanner connection="reconnecting" failures={0} code="HT7KM4" />
        <button type="button" onClick={() => setSideOpen(true)}>
          Scores
        </button>
        <button type="button" onClick={() => openRules('overview')}>
          Rules
        </button>
        <SideSheet open={sideOpen} onClose={() => setSideOpen(false)}>
          <p>Score pad</p>
        </SideSheet>
        <Toasts toasts={toasts} onDismiss={dismiss} />
        <RulesDrawer request={drawer} onClose={() => setDrawer(null)} />
      </RulesDrawerContext.Provider>
    </MemoryRouter>
  )
}

// jsdom has no showModal, so the dialogs never open and Testing Library can't find them by role.
const dialog = (name: string) =>
  document.querySelector<HTMLElement>(`dialog[aria-label="${name}"]`)!
const toasts = () => screen.getByRole('alert', { hidden: true })
const banner = () => screen.getByRole('status', { hidden: true })

describe('AboveModals', () => {
  it('moves the toasts and the banner into an open dialog, and back when it closes', async () => {
    render(<Page />)
    const alert = toasts()
    const status = banner()
    expect(alert.closest('dialog')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Rules' }))
    const rules = dialog('Rules')
    expect(rules).toContainElement(alert)
    expect(rules).toContainElement(status)
    // The banner goes first, at the top of the dialog; the toasts after the dialog's own controls.
    expect(rules.firstElementChild).toContainElement(status)
    expect(rules.lastElementChild).toContainElement(alert)

    await userEvent.click(within(rules).getByRole('button', { name: 'Close', hidden: true }))
    expect(alert.closest('dialog')).toBeNull()
    expect(status.closest('dialog')).toBeNull()
  })

  it('moves the same elements, so React never mounts a toast again', async () => {
    render(<Page />)
    const alert = toasts()
    const toast = screen.getByText(TOAST.message)
    await userEvent.click(screen.getByRole('button', { name: 'Rules' }))
    expect(toasts()).toBe(alert)
    expect(screen.getByText(TOAST.message)).toBe(toast)
  })

  it("keeps a toast's time running, not starting it over, when it moves", () => {
    vi.useFakeTimers()
    try {
      render(<Page />)
      act(() => vi.advanceTimersByTime(4000))
      act(() => screen.getByRole('button', { name: 'Rules' }).click())
      expect(dialog('Rules')).toContainElement(toasts())
      act(() => vi.advanceTimersByTime(2000))
      expect(screen.queryByText(TOAST.message)).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('goes into the topmost dialog when one opens from another', async () => {
    const onRules = vi.fn()
    render(<Page sheet onRules={onRules} />)
    const sheet = dialog('Score pad and table talk')
    expect(sheet).toContainElement(toasts())

    // Why? on the toast opens the rules over the sheet, and the toast goes with it.
    await userEvent.click(screen.getByRole('link', { name: 'Why?', hidden: true }))
    expect(onRules).toHaveBeenLastCalledWith('melds')
    expect(dialog('Rules')).toContainElement(toasts())
    expect(dialog('Rules')).toContainElement(banner())

    await userEvent.click(
      within(dialog('Rules')).getByRole('button', { name: 'Close', hidden: true }),
    )
    expect(sheet).toContainElement(toasts())
    expect(sheet).toContainElement(banner())
  })

  it('still opens the rules from Why? while the drawer is already open', async () => {
    const onRules = vi.fn()
    render(<Page onRules={onRules} />)
    await userEvent.click(screen.getByRole('button', { name: 'Rules' }))
    const why = within(dialog('Rules')).getByRole('link', { name: 'Why?', hidden: true })
    await userEvent.click(why)
    expect(onRules).toHaveBeenLastCalledWith('melds')
    expect(dialog('Rules')).toContainElement(toasts())

    await userEvent.click(
      within(dialog('Rules')).getByRole('button', { name: 'Dismiss', hidden: true }),
    )
    expect(screen.queryByText(TOAST.message)).toBeNull()
  })
})
