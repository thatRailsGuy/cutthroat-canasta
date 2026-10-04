import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { WaitingRoom } from '../src/pages/WaitingRoom'
import { makeView } from './fixtures'

describe('WaitingRoom', () => {
  it('tells a late joiner they are dealt in next hand, and lets them leave', async () => {
    const view = makeView({ hand: [], phase: 'draw' })
    view.waiting = [{ id: 'zed', name: 'Zed' }]
    const send = vi.fn()
    render(<WaitingRoom view={view} playerId="zed" connected={['bob']} send={send} />)
    expect(screen.getByText(/You're in, Zed/)).toHaveTextContent(
      "you'll be dealt in when the next one starts",
    )
    expect(screen.getByRole('list')).toHaveTextContent('YouBob')
    await userEvent.click(screen.getByRole('button', { name: 'Leave' }))
    expect(send).toHaveBeenCalledWith({ type: 'leave' })
  })
})
