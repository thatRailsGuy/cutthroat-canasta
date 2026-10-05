import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Hand, ROW_LIMIT } from '../src/components/Hand'
import { card } from './fixtures'

const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

function hand(count: number) {
  return Array.from({ length: count }, (_, i) => card(`${RANKS[i % RANKS.length]}s`, i + 1))
}

function rowSizes(): number[] {
  const section = screen.getByRole('region', { name: 'Your hand' })
  return [...section.children].map(
    (row) => within(row as HTMLElement).getAllByRole('button').length,
  )
}

describe('Hand', () => {
  it('wraps freely unless asked for rows', () => {
    render(<Hand cards={hand(13)} selected={[]} hidden={new Set()} onToggle={() => {}} />)
    const section = screen.getByRole('region', { name: 'Your hand' })
    expect(section.children).toHaveLength(13)
  })

  it('splits a phone hand into even rows of at most the row limit', () => {
    render(<Hand cards={hand(13)} selected={[]} hidden={new Set()} rows onToggle={() => {}} />)
    expect(rowSizes()).toEqual([7, 6])
  })

  it('keeps a short hand in one row', () => {
    render(
      <Hand cards={hand(ROW_LIMIT)} selected={[]} hidden={new Set()} rows onToggle={() => {}} />,
    )
    expect(rowSizes()).toEqual([ROW_LIMIT])
  })

  it('leaves staged cards out of the rows', () => {
    const cards = hand(12)
    render(
      <Hand
        cards={cards}
        selected={[]}
        hidden={new Set([cards[0].id, cards[1].id])}
        rows
        onToggle={() => {}}
      />,
    )
    expect(rowSizes()).toEqual([10])
  })

  it('shows your own order, and a Sort button to go back to sorted', async () => {
    const cards = hand(3)
    const onSort = vi.fn()
    const { rerender } = render(
      <Hand cards={cards} selected={[]} hidden={new Set()} onSort={onSort} onToggle={() => {}} />,
    )
    expect(screen.queryByRole('button', { name: 'Sort' })).toBeNull()
    rerender(
      <Hand
        cards={cards}
        selected={[]}
        hidden={new Set()}
        order={[1, 3, 2]}
        onSort={onSort}
        onToggle={() => {}}
      />,
    )
    const section = screen.getByRole('region', { name: 'Your hand' })
    expect(
      within(section)
        .getAllByRole('button')
        .map((b) => b.dataset.cardId),
    ).toEqual(['1', '3', '2'])
    expect(screen.getByText('your order')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sort' }))
    expect(onSort).toHaveBeenCalledOnce()
  })

  it('switches between Spread and One line', async () => {
    const onLayout = vi.fn()
    render(
      <Hand
        cards={hand(5)}
        selected={[]}
        hidden={new Set()}
        layout="line"
        onLayout={onLayout}
        onToggle={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: 'One line' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Spread' }))
    expect(onLayout).toHaveBeenCalledWith('spread')
  })

  it('moves the focused card with Alt and the arrow keys', () => {
    const onMove = vi.fn()
    render(
      <Hand
        cards={hand(3)}
        selected={[]}
        hidden={new Set()}
        order={[1, 2, 3]}
        onMove={onMove}
        onToggle={() => {}}
      />,
    )
    const [first, second] = within(screen.getByRole('region', { name: 'Your hand' })).getAllByRole(
      'button',
    )
    fireEvent.keyDown(first, { key: 'ArrowRight', altKey: true })
    expect(onMove).toHaveBeenLastCalledWith(1, 3)
    fireEvent.keyDown(second, { key: 'ArrowLeft', altKey: true })
    expect(onMove).toHaveBeenLastCalledWith(2, 1)
    fireEvent.keyDown(second, { key: 'ArrowLeft' })
    expect(onMove).toHaveBeenCalledTimes(2)
  })
})
