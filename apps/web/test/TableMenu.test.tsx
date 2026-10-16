import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { TableMenu, type TableMenuProps } from '../src/components/TableMenu'
import type { SoundLevel } from '../src/sounds'

function Harness(props: Partial<TableMenuProps>) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [level, setLevel] = useState<SoundLevel>(2)
  return (
    <>
      <TableMenu
        buttonRef={buttonRef}
        className=""
        host="Host tools"
        onHost={vi.fn()}
        onQuit={vi.fn()}
        level={level}
        onLevel={setLevel}
        {...props}
      />
      <p>The table</p>
    </>
  )
}

const menuButton = () => screen.getByRole('button', { name: 'Menu' })
const menu = () => within(screen.getByRole('dialog', { name: 'Menu' }))

describe('TableMenu', () => {
  it('lists host tools, sound, display and Quit game, with focus on the first', async () => {
    render(<Harness />)
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(menuButton())
    expect(menuButton()).toHaveAttribute('aria-expanded', 'true')
    expect(
      menu()
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label') ?? b.textContent),
    ).toEqual(['Host tools', 'Sound: My plays', 'Display options', 'Quit game'])
    expect(menu().getByRole('button', { name: 'Host tools' })).toHaveFocus()
  })

  it('leaves out host tools and Quit game for a player who has neither', async () => {
    render(<Harness host={null} onQuit={undefined} />)
    await userEvent.click(menuButton())
    expect(
      menu()
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Sound: My plays', 'Display options'])
  })

  it('opens the sound panel in its place, and Escape closes it back to Menu', async () => {
    render(<Harness />)
    await userEvent.click(menuButton())
    await userEvent.click(menu().getByRole('button', { name: 'Sound: My plays' }))
    expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull()
    expect(screen.getByRole('slider', { name: 'What you hear' })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('slider')).toBeNull()
    expect(menuButton()).toHaveFocus()
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens the display panel in its place, with focus on its first switch', async () => {
    render(<Harness />)
    await userEvent.click(menuButton())
    await userEvent.click(menu().getByRole('button', { name: 'Display options' }))
    const display = within(screen.getByRole('dialog', { name: 'Display' }))
    expect(display.getAllByRole('switch')[0]).toHaveFocus()
  })

  it('closes before opening the host tools or the quit confirm, with focus on Menu', async () => {
    const onHost = vi.fn(() => expect(menuButton()).toHaveFocus())
    const onQuit = vi.fn(() => expect(menuButton()).toHaveFocus())
    render(<Harness onHost={onHost} onQuit={onQuit} />)
    await userEvent.click(menuButton())
    await userEvent.click(menu().getByRole('button', { name: 'Host tools' }))
    expect(onHost).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull()

    await userEvent.click(menuButton())
    await userEvent.click(menu().getByRole('button', { name: 'Quit game' }))
    expect(onQuit).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull()
  })

  it('closes on a click outside it', async () => {
    const onOpen = vi.fn()
    render(<Harness onOpen={onOpen} />)
    await userEvent.click(menuButton())
    expect(onOpen).toHaveBeenCalledOnce()
    await userEvent.click(screen.getByText('The table'))
    expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull()
  })
})
