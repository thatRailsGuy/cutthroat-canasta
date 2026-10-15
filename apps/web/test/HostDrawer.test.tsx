import { fireEvent, render, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HostDrawer, type HostDrawerProps } from '../src/components/HostDrawer'
import { makeView } from './fixtures'

const bob = makeView({ hand: [], phase: 'draw' }).players[1]
const cy = { ...bob, id: 'cy', name: 'Cy' }

function setup(overrides: Partial<HostDrawerProps> = {}) {
  const props: HostDrawerProps = {
    open: true,
    onClose: vi.fn(),
    code: 'ABCD',
    seats: [
      { player: bob, seat: 1 },
      { player: cy, seat: 2 },
    ],
    waiting: [],
    full: false,
    playing: true,
    offline: false,
    connected: ['cy'],
    links: {},
    refusals: 0,
    onReissue: vi.fn(() => true),
    onRedeal: vi.fn(),
    ...overrides,
  }
  const view = render(<HostDrawer {...props} />)
  // jsdom can't open a modal dialog, so its contents count as hidden.
  const drawer = within(view.container.querySelector('dialog')!)
  const button = (name: string) => drawer.getByRole('button', { name, hidden: true })
  return { props, drawer, button, ...view }
}

describe('HostDrawer', () => {
  it('shares an invite link and a QR code until the table is full', () => {
    const { drawer, rerender, props } = setup({ waiting: [{ id: 'z', name: 'Zed' }] })
    expect(drawer.getByRole('textbox', { name: 'Invite link', hidden: true })).toHaveValue(
      `${window.location.origin}/g/ABCD`,
    )
    expect(
      drawer.getByRole('img', { name: 'QR code for the invite link', hidden: true }),
    ).toBeInTheDocument()
    expect(drawer.getByText('For a new player: takes a new seat')).toBeInTheDocument()
    expect(drawer.getByText('A B C D')).toBeInTheDocument()
    expect(drawer.getByText('Dealt in next hand: Zed')).toBeInTheDocument()

    rerender(<HostDrawer {...props} full />)
    expect(drawer.getByText('The table is full.')).toBeInTheDocument()
    expect(drawer.queryByRole('textbox', { name: 'Invite link', hidden: true })).toBeNull()
    expect(drawer.queryByText('A B C D')).toBeNull()
  })

  describe('without the Clipboard API, as over plain http on a LAN', () => {
    const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    const execCommand = Object.getOwnPropertyDescriptor(document, 'execCommand')
    function withoutClipboard(copies: boolean) {
      Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
      const exec = vi.fn(() => copies)
      Object.defineProperty(document, 'execCommand', { value: exec, configurable: true })
      return exec
    }
    afterEach(() => {
      if (clipboard) Object.defineProperty(navigator, 'clipboard', clipboard)
      else delete (navigator as { clipboard?: unknown }).clipboard
      if (execCommand) Object.defineProperty(document, 'execCommand', execCommand)
      else delete (document as { execCommand?: unknown }).execCommand
    })

    it('copies the invite link with the copy command', () => {
      const exec = withoutClipboard(true)
      const { drawer, button } = setup()
      fireEvent.click(button('Copy'))
      expect(exec).toHaveBeenCalledWith('copy')
      expect(drawer.getByText('Copied')).toBeInTheDocument()
    })

    it('selects the whole link before copying, and leaves the box read-only', () => {
      let selection: [number | null, number | null] = [null, null]
      const exec = vi.fn(() => {
        const input = document.activeElement as HTMLInputElement
        selection = [input.selectionStart, input.selectionEnd]
        return true
      })
      withoutClipboard(true)
      Object.defineProperty(document, 'execCommand', { value: exec, configurable: true })
      const { drawer, button } = setup()
      fireEvent.click(button('Copy'))
      const input = drawer.getByRole('textbox', { name: 'Invite link', hidden: true })
      expect(selection).toEqual([0, (input as HTMLInputElement).value.length])
      expect(input).toHaveAttribute('readonly')
    })

    it("doesn't say Copied when the link couldn't be selected", () => {
      const exec = withoutClipboard(true)
      // Neither way of selecting takes, as on a browser that won't select the box.
      const range = vi
        .spyOn(HTMLInputElement.prototype, 'setSelectionRange')
        .mockImplementation(() => {})
      const select = vi.spyOn(HTMLInputElement.prototype, 'select').mockImplementation(() => {})
      const { drawer, button } = setup()
      fireEvent.click(button('Copy'))
      range.mockRestore()
      select.mockRestore()
      expect(exec).not.toHaveBeenCalled()
      expect(drawer.getByText('Select and copy')).toBeInTheDocument()
    })

    it('leaves the link selected to copy by hand when the copy command fails', () => {
      withoutClipboard(false)
      const { drawer, button } = setup()
      fireEvent.click(button('Copy'))
      expect(drawer.getByText('Select and copy')).toBeInTheDocument()
    })
  })

  it('asks before throwing out the hand', async () => {
    const user = userEvent.setup()
    const { props, button } = setup()
    await user.click(button('Deal a new hand…'))
    expect(props.onRedeal).not.toHaveBeenCalled()
    await user.click(button('Deal new hand'))
    expect(props.onRedeal).toHaveBeenCalledOnce()
    expect(props.onClose).toHaveBeenCalled()
  })

  it('offers a rejoin link for each seat, and shows the link once it is made', async () => {
    const user = userEvent.setup()
    const { props, button, drawer, rerender } = setup()
    await user.click(button('Make a rejoin link for Bob'))
    expect(props.onReissue).toHaveBeenCalledWith('bob')
    // Cy is still connected, so the button is the quieter "Seat stuck?" one.
    expect(button('Seat stuck? Make a rejoin link for Cy')).toBeInTheDocument()

    rerender(<HostDrawer {...props} links={{ bob: 'https://example.test/g/ABCD#token=t' }} />)
    expect(drawer.getByRole('textbox', { name: "Bob's rejoin link", hidden: true })).toHaveValue(
      'https://example.test/g/ABCD#token=t',
    )
  })

  describe('rejoin tickets', () => {
    const bobLink = 'https://example.test/g/ABCD#token=b'
    const cyLink = 'https://example.test/g/ABCD#token=c'
    const qrCodes = (drawer: ReturnType<typeof setup>['drawer']) =>
      drawer
        .queryAllByRole('img', { name: /^QR code/, hidden: true })
        .map((qr) => qr.getAttribute('aria-label'))

    /** Makes Bob's link, as the host would: the button, then the link from the server. */
    async function withBobsTicket() {
      const user = userEvent.setup()
      const view = setup()
      await user.click(view.button('Make a rejoin link for Bob'))
      view.rerender(<HostDrawer {...view.props} links={{ bob: bobLink }} />)
      return { user, ...view }
    }

    it('opens a ticket with a QR code as soon as the link is made', async () => {
      const { drawer } = await withBobsTicket()
      const ticket = drawer.getByRole('group', { name: 'Rejoin link for Bob', hidden: true })
      const inTicket = within(ticket)
      expect(inTicket.getByText("Opens Bob's seat and hand")).toBeInTheDocument()
      expect(
        inTicket.getByRole('img', { name: "QR code for Bob's rejoin link", hidden: true }),
      ).toBeInTheDocument()
      expect(inTicket.getByText("Bob's seat")).toBeInTheDocument()
      expect(ticket).toHaveTextContent(
        "Private. Whoever scans this plays as Bob and sees Bob's hand. Show it only to Bob.",
      )
      // The copy box's label is on the page, not only in its name.
      expect(inTicket.getByText("Bob's rejoin link").tagName).toBe('LABEL')
      expect(
        inTicket.getByRole('textbox', { name: "Bob's rejoin link", hidden: true }),
      ).toHaveValue(bobLink)
      // The button that was pressed is gone, so the ticket takes focus.
      expect(ticket).toHaveFocus()
    })

    it('folds the invite away while a ticket is open, so one QR code shows at a time', async () => {
      const { user, drawer, button } = await withBobsTicket()
      expect(qrCodes(drawer)).toEqual(["QR code for Bob's rejoin link"])
      expect(drawer.queryByRole('textbox', { name: 'Invite link', hidden: true })).toBeNull()
      expect(
        drawer.getByText(/The invite link opens the join form and takes a new seat\./),
      ).toBeInTheDocument()

      // Hiding the ticket unfolds the invite, and Show QR takes focus.
      await user.click(button('Hide QR'))
      expect(qrCodes(drawer)).toEqual(['QR code for the invite link'])
      expect(drawer.getByText('For a new player: takes a new seat')).toBeInTheDocument()
      expect(button('Show QR for Bob')).toHaveFocus()
      expect(drawer.getByRole('textbox', { name: "Bob's rejoin link", hidden: true })).toHaveValue(
        bobLink,
      )

      await user.click(button('Show QR for Bob'))
      expect(qrCodes(drawer)).toEqual(["QR code for Bob's rejoin link"])

      // Show invite closes the ticket.
      await user.click(button('Show invite'))
      expect(qrCodes(drawer)).toEqual(['QR code for the invite link'])
      expect(drawer.getByRole('heading', { name: 'Invite a player', hidden: true })).toHaveFocus()
      expect(button('Show QR for Bob')).toBeInTheDocument()
    })

    it('opens one ticket at a time', async () => {
      const { user, drawer, button, props, rerender } = await withBobsTicket()
      await user.click(button('Seat stuck? Make a rejoin link for Cy'))
      // Bob's ticket stays open until Cy's link comes.
      expect(qrCodes(drawer)).toEqual(["QR code for Bob's rejoin link"])
      rerender(<HostDrawer {...props} links={{ bob: bobLink, cy: cyLink }} />)
      expect(qrCodes(drawer)).toEqual(["QR code for Cy's rejoin link"])
      expect(drawer.getByRole('group', { name: 'Rejoin link for Cy', hidden: true })).toHaveFocus()

      await user.click(button('Show QR for Bob'))
      expect(qrCodes(drawer)).toEqual(["QR code for Bob's rejoin link"])
      expect(button('Show QR for Cy')).toBeInTheDocument()
    })

    it('closes the ticket and unfolds the invite when its player leaves', async () => {
      const { drawer, props, rerender } = await withBobsTicket()
      rerender(<HostDrawer {...props} seats={[{ player: cy, seat: 2 }]} links={{ bob: bobLink }} />)
      expect(qrCodes(drawer)).toEqual(['QR code for the invite link'])
      expect(drawer.queryByText(/rejoin QR is up/)).toBeNull()
      // Focus went with the ticket, so the invite takes it.
      expect(drawer.getByRole('heading', { name: 'Invite a player', hidden: true })).toHaveFocus()
    })

    it("doesn't open a link over a ticket opened since it was asked for", async () => {
      const { user, drawer, button, props, rerender } = await withBobsTicket()
      await user.click(button('Hide QR'))
      await user.click(button('Seat stuck? Make a rejoin link for Cy'))
      await user.click(button('Show QR for Bob'))
      rerender(<HostDrawer {...props} links={{ bob: bobLink, cy: cyLink }} />)
      expect(qrCodes(drawer)).toEqual(["QR code for Bob's rejoin link"])
      expect(drawer.getByRole('group', { name: 'Rejoin link for Bob', hidden: true })).toHaveFocus()
      expect(button('Show QR for Cy')).toBeInTheDocument()
    })

    it('forgets a request the server refused, so a late link opens no ticket', async () => {
      const user = userEvent.setup()
      const { drawer, button, props, rerender } = setup()
      await user.click(button('Make a rejoin link for Bob'))
      rerender(<HostDrawer {...props} refusals={1} />)
      rerender(<HostDrawer {...props} refusals={1} links={{ bob: bobLink }} />)
      expect(qrCodes(drawer)).toEqual(['QR code for the invite link'])
      expect(button('Show QR for Bob')).not.toHaveFocus()
    })

    it("forgets a request that couldn't be sent", async () => {
      const user = userEvent.setup()
      const { drawer, button, props, rerender } = setup({ onReissue: vi.fn(() => false) })
      await user.click(button('Make a rejoin link for Bob'))
      rerender(<HostDrawer {...props} links={{ bob: bobLink }} />)
      expect(qrCodes(drawer)).toEqual(['QR code for the invite link'])
    })

    it('leaves focus alone if the host has moved on while the link comes', async () => {
      const user = userEvent.setup()
      const { drawer, button, props, rerender } = setup()
      await user.click(button('Make a rejoin link for Bob'))
      button('Seat stuck? Make a rejoin link for Cy').focus()
      rerender(<HostDrawer {...props} links={{ bob: bobLink }} />)
      expect(qrCodes(drawer)).toEqual(["QR code for Bob's rejoin link"])
      expect(button('Seat stuck? Make a rejoin link for Cy')).toHaveFocus()
    })

    it('moves focus to the new ticket when it closes the one that had focus', async () => {
      const { user, drawer, button, props, rerender } = await withBobsTicket()
      await user.click(button('Seat stuck? Make a rejoin link for Cy'))
      const bobsTicket = drawer.getByRole('group', { name: 'Rejoin link for Bob', hidden: true })
      within(bobsTicket).getByRole('button', { name: 'Copy', hidden: true }).focus()
      rerender(<HostDrawer {...props} links={{ bob: bobLink, cy: cyLink }} />)
      expect(drawer.getByRole('group', { name: 'Rejoin link for Cy', hidden: true })).toHaveFocus()
    })

    it("doesn't open the ticket again with the drawer", async () => {
      const { drawer, button, props, rerender } = await withBobsTicket()
      fireEvent.click(button('Close'))
      rerender(<HostDrawer {...props} links={{ bob: bobLink }} open={false} />)
      rerender(<HostDrawer {...props} links={{ bob: bobLink }} />)
      expect(qrCodes(drawer)).toEqual(['QR code for the invite link'])
    })
  })

  it('has no new hand between rounds', () => {
    const { drawer } = setup({ playing: false })
    expect(drawer.queryByRole('button', { name: 'Deal a new hand…', hidden: true })).toBeNull()
  })

  it('closes from a click on the table behind it, but not on its contents', async () => {
    const user = userEvent.setup()
    const { props, drawer, container } = setup()
    await user.click(drawer.getByText('Invite a player'))
    expect(props.onClose).not.toHaveBeenCalled()
    await user.click(container.querySelector('dialog')!)
    expect(props.onClose).toHaveBeenCalledOnce()
  })

  it('explains standing in for an away host, and leaves out the new hand', () => {
    const { drawer, rerender, props } = setup({ standIn: { hostName: 'Ann' } })
    expect(
      drawer.getByRole('heading', { name: 'Stand in for the host', hidden: true }),
    ).toBeInTheDocument()
    expect(
      drawer.getByText(/Ann is the host, but they're away\. If you make a rejoin link/),
    ).toBeInTheDocument()
    expect(drawer.queryByRole('button', { name: 'Deal a new hand…', hidden: true })).toBeNull()
    expect(
      drawer.getByRole('button', { name: 'Make a rejoin link for Bob', hidden: true }),
    ).toBeInTheDocument()

    rerender(<HostDrawer {...props} standIn={{ hostName: null }} />)
    expect(drawer.getByText(/^The host is away\./)).toBeInTheDocument()
  })
})
