import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { SoundButton } from '../src/components/SoundButton'
import type { SoundLevel } from '../src/sounds'

function Harness({ start = 2 }: { start?: SoundLevel }) {
  const [level, setLevel] = useState<SoundLevel>(start)
  return (
    <>
      <SoundButton level={level} onLevel={setLevel} />
      <p>The table</p>
    </>
  )
}

describe('SoundButton', () => {
  it('names the step, and opens a slider that changes it', async () => {
    render(<Harness />)
    const button = screen.getByRole('button', { name: 'Sound: My plays' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')

    const slider = screen.getByRole('slider', { name: 'What you hear' })
    expect(slider).toHaveAttribute('aria-valuetext', 'My plays')
    fireEvent.change(slider, { target: { value: '0' } })
    expect(slider).toHaveAttribute('aria-valuetext', 'Off')
    expect(screen.getByRole('button', { name: 'Sound: Off' })).toBeInTheDocument()
    expect(screen.getByText(/No sound at all/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Play a test sound' })).toBeDisabled()
  })

  it('closes on Escape or a click outside it', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: /^Sound/ }))
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('slider')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: /^Sound/ }))
    await userEvent.click(screen.getByRole('slider'))
    expect(screen.getByRole('slider')).toBeInTheDocument()
    await userEvent.click(screen.getByText('The table'))
    expect(screen.queryByRole('slider')).toBeNull()
  })

  it('charts what each step plays, with your step shaded', async () => {
    render(<Harness start={1} />)
    await userEvent.click(screen.getByRole('button', { name: /^Sound/ }))
    await userEvent.click(screen.getByRole('button', { name: 'What each step plays' }))
    // jsdom has no showModal, so the chart stays hidden from the accessibility tree.
    const chart = screen.getByRole('table', { hidden: true })
    const current = within(chart).getByRole('columnheader', { current: true, hidden: true })
    expect(current).toHaveTextContent('Turn alert')
    const turn = within(chart).getByRole('row', { name: /Your turn starts/, hidden: true })
    expect(
      within(turn)
        .getAllByRole('cell', { hidden: true })
        .map((c) => c.ariaLabel),
    ).toEqual(['Silent', 'Plays', 'Plays', 'Plays'])
  })

  it('turns the chat clink off, and greys it out while all sound is off', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: /^Sound/ }))
    const clink = screen.getByRole('checkbox', { name: 'Clink for new chat lines' })
    expect(clink).toBeChecked()
    await userEvent.click(clink)
    expect(clink).not.toBeChecked()
    expect(localStorage.getItem('canasta:chatSound')).toBe('off')
    await userEvent.click(clink)

    fireEvent.change(screen.getByRole('slider'), { target: { value: '0' } })
    expect(clink).toBeDisabled()
    expect(clink).toBeChecked()
    localStorage.clear()
  })
})
