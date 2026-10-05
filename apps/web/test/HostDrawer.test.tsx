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
    onReissue: vi.fn(),
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
    expect(drawer.getByRole('img', { name: /QR code/, hidden: true })).toBeInTheDocument()
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
    expect(drawer.getByRole('textbox', { name: 'Rejoin link for Bob', hidden: true })).toHaveValue(
      'https://example.test/g/ABCD#token=t',
    )
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
})
