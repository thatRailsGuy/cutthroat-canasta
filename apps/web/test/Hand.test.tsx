import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
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
})
