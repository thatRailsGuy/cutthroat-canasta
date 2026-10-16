import type { PlayerView } from '@canasta/engine'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useCallback, useState } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RulesDrawer } from '../src/components/RulesDrawer'
import { ScoreSheet } from '../src/components/ScoreSheet'
import { SideSheet } from '../src/components/SideSheet'
import { Toasts, useToastList } from '../src/components/Toasts'
import type { Toast } from '../src/gameState'
import { ConnectionBanner } from '../src/pages/GamePage'
import { RulesDrawerContext, useRulesDrawer } from '../src/rules/drawer'
import type { PageSection } from '../src/rules/sections'
import { makeView } from './fixtures'

const TOAST: Toast = { id: 1, message: 'A meld needs at least 2 natural cards.', section: 'melds' }
const LATER: Toast = { id: 2, message: 'Not connected.', section: null }

/** The part of a table that remounts with each deal: here, just the side sheet. */
function Deal({ sheet }: { sheet: boolean }) {
  const [open, setOpen] = useState(sheet)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Scores
      </button>
      <SideSheet open={open} onClose={() => setOpen(false)}>
        <p>Score pad</p>
      </SideSheet>
    </>
  )
}

/** A game page in small: the banner, a toast, the side sheet and the rules drawer. */
function Page({
  sheet = false,
  deal = 1,
  onRules,
}: {
  sheet?: boolean
  deal?: number
  onRules?: (s: PageSection) => void
}) {
  const { request, open, close } = useRulesDrawer()
  const toasts = useToastList([TOAST])
  const openRules = useCallback(
    (section: PageSection) => {
      onRules?.(section)
      open(section)
    },
    [onRules, open],
  )
  return (
    <MemoryRouter>
      <RulesDrawerContext.Provider value={openRules}>
        <ConnectionBanner connection="reconnecting" failures={0} code="HT7KM4" />
        <Deal key={deal} sheet={sheet} />
        <button type="button" onClick={() => openRules('overview')}>
          Rules
        </button>
        <button type="button" onClick={() => toasts.add(LATER)}>
          Another toast
        </button>
        <Toasts toasts={toasts.toasts} onDismiss={toasts.dismiss} />
        <RulesDrawer request={request} onClose={close} />
      </RulesDrawerContext.Provider>
    </MemoryRouter>
  )
}

// jsdom has no showModal, so the dialogs never open and Testing Library can't find them by role.
const dialog = (name: string) =>
  document.querySelector<HTMLElement>(`dialog[aria-label="${name}"]`)!
const toast = () => screen.getByText(TOAST.message, { selector: 'span' })
const banners = () => screen.getAllByText('Reconnecting…', { selector: 'p' })
const bannerIn = (el: HTMLElement) => within(el).queryByText('Reconnecting…', { selector: 'p' })
const why = () => screen.getByRole('link', { name: 'Why?', hidden: true })
const LIVE = '[role="alert"], [role="status"], [aria-live]'

/** Stands in for a browser's showModal and close, as far as these tests need them. */
function stubDialogs() {
  const proto = HTMLDialogElement.prototype
  Object.defineProperty(proto, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute('open', '')
      this.querySelector('button')?.focus()
    },
  })
  Object.defineProperty(proto, 'close', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.removeAttribute('open')
      // A browser puts focus back where it was before, but can't put it in a closed dialog.
      const active = document.activeElement
      if (active instanceof HTMLElement && this.contains(active)) active.blur()
    },
  })
}

afterEach(() => {
  // Unmount while the stand-ins are still there, so the open dialogs can close.
  cleanup()
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close')
})

describe('AboveModals', () => {
  it('shows the toasts and the banner in an open dialog, and takes them back when it closes', async () => {
    render(<Page />)
    const item = toast()
    expect(item.closest('dialog')).toBeNull()
    expect(banners()).toHaveLength(1)

    await userEvent.click(screen.getByRole('button', { name: 'Rules' }))
    const rules = dialog('Rules')
    expect(rules).toContainElement(item)
    // The banner goes first, at the top of the dialog; the toasts after the dialog's own controls.
    const close = within(rules).getByRole('button', { name: 'Close', hidden: true })
    expect(bannerIn(rules)!.compareDocumentPosition(close)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(rules.lastElementChild).toContainElement(item)
    // The page keeps its own banner, so nothing behind the dialog moves.
    expect(banners()).toHaveLength(2)
    expect(banners()[0].closest('dialog')).toBeNull()

    await userEvent.click(close)
    expect(item.closest('dialog')).toBeNull()
    expect(banners()).toHaveLength(1)
    expect(bannerIn(rules)).toBeNull()
  })

  it('moves the same elements, so React never mounts a toast again', async () => {
    render(<Page />)
    const item = toast()
    await userEvent.click(screen.getByRole('button', { name: 'Rules' }))
    expect(toast()).toBe(item)
  })

  it("keeps a toast's time running, not starting it over, when it moves", () => {
    vi.useFakeTimers()
    try {
      render(<Page />)
      act(() => vi.advanceTimersByTime(4000))
      act(() => screen.getByRole('button', { name: 'Rules' }).click())
      expect(dialog('Rules')).toContainElement(toast())
      act(() => vi.advanceTimersByTime(2000))
      expect(screen.queryByText(TOAST.message, { selector: 'span' })).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('goes into the topmost dialog when one opens from another', async () => {
    const onRules = vi.fn()
    render(<Page sheet onRules={onRules} />)
    const sheet = dialog('Score pad and table talk')
    expect(sheet).toContainElement(toast())

    // Why? on the toast opens the rules over the sheet, and the toast goes with it.
    await userEvent.click(why())
    expect(onRules).toHaveBeenLastCalledWith('melds')
    expect(dialog('Rules')).toContainElement(toast())
    expect(bannerIn(dialog('Rules'))).not.toBeNull()
    expect(bannerIn(sheet)).toBeNull()

    await userEvent.click(
      within(dialog('Rules')).getByRole('button', { name: 'Close', hidden: true }),
    )
    expect(sheet).toContainElement(toast())
    expect(bannerIn(sheet)).not.toBeNull()
  })

  it('still opens the rules from Why? while the drawer is already open', async () => {
    const onRules = vi.fn()
    render(<Page onRules={onRules} />)
    await userEvent.click(screen.getByRole('button', { name: 'Rules' }))
    await userEvent.click(within(dialog('Rules')).getByRole('link', { name: 'Why?', hidden: true }))
    expect(onRules).toHaveBeenLastCalledWith('melds')
    expect(dialog('Rules')).toContainElement(toast())

    await userEvent.click(
      within(dialog('Rules')).getByRole('button', { name: 'Dismiss', hidden: true }),
    )
    expect(screen.queryByText(TOAST.message, { selector: 'span' })).toBeNull()
  })

  it('says a toast once, and never brings a live region with words in it back into the page', async () => {
    render(<Page />)
    const alert = screen.getByRole('alert', { hidden: true })
    expect(alert).toHaveTextContent(TOAST.message)
    expect(toast().closest(LIVE)).toBeNull()
    expect(banners()[0].closest(LIVE)).toBeNull()

    const added: Node[] = []
    const observer = new MutationObserver((records) =>
      records.forEach((r) => added.push(...r.addedNodes)),
    )
    observer.observe(document.body, { childList: true, subtree: true })
    await userEvent.click(screen.getByRole('button', { name: 'Rules' }))
    await userEvent.click(
      within(dialog('Rules')).getByRole('button', { name: 'Close', hidden: true }),
    )
    added.push(...observer.takeRecords().flatMap((r) => [...r.addedNodes]))
    observer.disconnect()
    const regions = added
      .filter((node) => node instanceof Element)
      .flatMap((el) => [...(el.matches(LIVE) ? [el] : []), ...el.querySelectorAll(LIVE)])
    expect(regions.length).toBeGreaterThan(0)
    for (const region of regions) expect(region.textContent).toBe('')

    // A toast that comes while a dialog is open is said there.
    await userEvent.click(screen.getByRole('button', { name: 'Rules' }))
    await userEvent.click(screen.getByRole('button', { name: 'Another toast' }))
    expect(within(dialog('Rules')).getByRole('alert', { hidden: true })).toHaveTextContent(
      LATER.message,
    )
  })

  it('puts focus back on the Why? link when the rules it opened close', async () => {
    stubDialogs()
    render(<Page sheet />)
    await userEvent.click(why())
    expect(dialog('Rules')).toContainElement(toast())
    expect(why()).not.toHaveFocus()

    await userEvent.click(
      within(dialog('Rules')).getByRole('button', { name: 'Close', hidden: true }),
    )
    expect(dialog('Score pad and table talk')).toContainElement(why())
    expect(why()).toHaveFocus()
  })

  it('keeps the toasts, and their focus, when the dialog they are in unmounts', () => {
    vi.useFakeTimers()
    try {
      const { rerender } = render(<Page sheet />)
      expect(dialog('Score pad and table talk')).toContainElement(toast())
      act(() => why().focus())

      // A new deal remounts the table and the sheet in it.
      rerender(<Page deal={2} />)
      expect(toast().closest('dialog')).toBeNull()
      expect(bannerIn(document.body)).not.toBeNull()
      expect(why()).toHaveFocus()

      // The toast is held only while it has focus, so it goes once focus moves on.
      act(() => screen.getByRole('button', { name: 'Rules' }).focus())
      act(() => vi.advanceTimersByTime(6000))
      expect(screen.queryByText(TOAST.message, { selector: 'span' })).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps the toasts last in the score sheet when its contents change', () => {
    const view = makeView({ hand: [], phase: 'draw' })
    const scored: PlayerView = {
      ...view,
      history: [
        {
          round: 1,
          endedBy: 'stockOut',
          wentOut: null,
          breakdown: {
            you: {
              meldPoints: 120,
              canastaBonus: 0,
              red3Points: 0,
              goingOutBonus: 0,
              concealedBonus: 0,
              handPenalty: 20,
              total: 100,
            },
          },
          hands: {},
        },
      ],
    }
    const page = (v: PlayerView) => (
      <MemoryRouter>
        <ScoreSheet view={v} open onClose={() => {}} />
        <Toasts toasts={[TOAST]} onDismiss={() => {}} />
      </MemoryRouter>
    )
    const { rerender } = render(page(view))
    const sheet = dialog('Scores')
    expect(sheet.lastElementChild).toContainElement(toast())

    rerender(page(scored))
    within(sheet).getByRole('table', { name: 'Running totals', hidden: true })
    expect(sheet.lastElementChild).toContainElement(toast())
  })
})
