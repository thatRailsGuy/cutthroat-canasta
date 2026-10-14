import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { EmptySeats } from '@canasta/server/protocol'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { JoinForm, type JoinFormProps } from '../src/pages/GamePage'
import { saveName } from '../src/storage'

const ann = { name: 'Ann', host: false }
const bea = { name: 'Bea', host: true }

const seats = (overrides: Partial<EmptySeats> = {}): EmptySeats => ({
  started: true,
  host: 'Bea',
  away: [],
  ...overrides,
})

function setup(overrides: Partial<JoinFormProps> = {}) {
  const props: JoinFormProps = {
    code: 'K7QMPR',
    error: null,
    seatTaken: false,
    nameTaken: false,
    emptySeats: seats(),
    waiting: false,
    onJoin: vi.fn(),
    ...overrides,
  }
  const { rerender } = render(<JoinForm {...props} />)
  return {
    props,
    rerender: (changes: Partial<JoinFormProps>) => rerender(<JoinForm {...props} {...changes} />),
  }
}

describe('JoinForm', () => {
  beforeEach(() => localStorage.clear())

  it('shows only the form when no seat is away', () => {
    setup()
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Your name' })).toBeInTheDocument()
  })

  it('says nothing about empty seats in the lobby', () => {
    setup({ emptySeats: seats({ started: false, away: [ann] }) })
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })

  it('asks the player of an empty seat to get their link from the host', () => {
    setup({ emptySeats: seats({ away: [ann] }) })
    const region = screen.getByRole('region', { name: 'Empty seat' })
    expect(screen.getByRole('listitem')).toHaveTextContent('Ann')
    expect(region).toHaveTextContent(
      'Are you Ann? Ask Bea, the host, for your rejoin link. It puts you back in your seat with your cards and score. Joining here gives you a new seat instead.',
    )
    expect(region).toHaveTextContent(
      "New to the table? Join below. You'll watch this hand and be dealt in with the next one.",
    )
  })

  it('sends them to anyone at the table while the host is away too', () => {
    setup({ emptySeats: seats({ host: null, away: [ann, bea] }) })
    const region = screen.getByRole('region', { name: '2 empty seats' })
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Ann', 'Beahost'])
    expect(region).toHaveTextContent(
      'Is one of them yours? Ask someone at the table for your rejoin link. While Bea is away, anyone playing can make one. Joining here gives you a new seat instead.',
    )
  })

  it("says when the name typed is an empty seat's", async () => {
    setup({ emptySeats: seats({ away: [ann] }) })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await userEvent.type(screen.getByRole('textbox', { name: 'Your name' }), 'ann')
    expect(screen.getByRole('alert')).toHaveTextContent(
      "That's the name on the empty seat. If you're Ann, ask Bea, the host, for your rejoin link. If not, choose another name.",
    )
  })

  it("says it in place of the server's refusal, while the seat is empty", () => {
    saveName('Bea')
    const error = 'Someone at the table is already called Bea.'
    const { rerender } = setup({
      error,
      nameTaken: true,
      emptySeats: seats({ host: null, away: [ann, bea] }),
    })
    expect(screen.getByRole('alert')).toHaveTextContent(
      "That's the name on an empty seat. If you're Bea, ask someone at the table for your rejoin link. If not, choose another name.",
    )
    expect(screen.queryByText(error)).not.toBeInTheDocument()

    // Bea is back, so the server's answer is the right one again.
    rerender({ emptySeats: seats({ away: [ann] }) })
    expect(screen.getByRole('alert')).toHaveTextContent(error)
  })
})
