import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SideSheet } from '../src/components/SideSheet'

describe('SideSheet', () => {
  it('closes from its Close button', async () => {
    const onClose = vi.fn()
    render(
      <SideSheet open onClose={onClose}>
        <p>Score pad</p>
      </SideSheet>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Close', hidden: true }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('closes from a tap on the backdrop, but not on its contents', async () => {
    const onClose = vi.fn()
    const { container } = render(
      <SideSheet open onClose={onClose}>
        <p>Score pad</p>
      </SideSheet>,
    )
    await userEvent.click(screen.getByText('Score pad'))
    expect(onClose).not.toHaveBeenCalled()
    await userEvent.click(container.querySelector('dialog')!)
    expect(onClose).toHaveBeenCalledOnce()
  })
})
