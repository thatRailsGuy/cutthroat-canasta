import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { initialGameState } from '../src/gameState'
import { Table } from '../src/pages/Table'
import { makeView } from './fixtures'

/** Zed joined mid-hand: no seat, no hand, waiting for the next deal. */
function watching() {
  const view = makeView({ hand: [], phase: 'draw' })
  view.you = null
  view.waiting = [{ id: 'zed', name: 'Zed' }]
  const state = { ...initialGameState, playerId: 'zed', view, connection: 'open' as const }
  const send = vi.fn(() => true)
  render(
    <MemoryRouter>
      <Table code="HT7KM4" view={view} state={state} send={send} />
    </MemoryRouter>,
  )
  return { send }
}

describe('Table, for a player waiting for the next hand', () => {
  it('shows the table with everyone as an opponent, and no hand', () => {
    watching()
    expect(screen.getByRole('region', { name: /^You,/ })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /^Bob/ })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Your hand' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Quit game' })).toBeNull()
  })

  it('says when they are dealt in, and lets them leave', async () => {
    const { send } = watching()
    const note = screen.getByRole('region', { name: 'You' })
    expect(within(note).getByRole('heading')).toHaveTextContent('Pull up a chair, Zed')
    expect(note).toHaveTextContent("you'll play after Bob")
    await userEvent.click(within(note).getByRole('button', { name: 'Leave' }))
    expect(send).toHaveBeenCalledWith({ type: 'leave' })
  })

  it('pencils them into the score pad at 0', () => {
    watching()
    const pad = screen.getByRole('region', { name: 'Score pad' })
    expect(within(pad).getByTitle('Zed, dealt in next hand')).toBeInTheDocument()
  })
})
