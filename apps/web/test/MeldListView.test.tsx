import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MeldList } from '../src/components/MeldList'
import { card } from './fixtures'

describe('MeldList', () => {
  it('names each meld for screen readers, with its progress to a canasta', () => {
    const melds = [
      { id: 'm1', rank: 'Q' as const, cards: ['Qh', 'Qs', 'Qd'].map((c, i) => card(c, i + 1)) },
      {
        id: 'm2',
        rank: 'K' as const,
        cards: ['Kh', 'Ks', 'Kd', 'Kc', 'Kh', 'Ks', 'Kd'].map((c, i) => card(c, i + 10)),
      },
    ]
    render(<MeldList melds={melds} red3s={[card('3h', 30)]} />)
    expect(screen.getByRole('img', { name: 'Queens: 3 cards' })).toBeInTheDocument()
    expect(screen.getByText('3 of 7')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Kings: Natural canasta, 7 cards' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Red 3s: 1' })).toBeInTheDocument()
  })

  it('shows chips with the same names and the hooks the table animations look for', () => {
    const melds = [
      {
        id: 'm2',
        rank: 'K' as const,
        cards: ['Kh', 'Ks', 'Kd', 'Kc', 'Kh', 'Ks', '2d'].map((c, i) => card(c, i + 10)),
      },
    ]
    render(<MeldList melds={melds} red3s={[card('3h', 30)]} chips />)
    const kings = screen.getByRole('img', { name: 'Kings: Mixed canasta, 7 cards' })
    expect(kings).toHaveTextContent('K×7')
    expect(kings).toHaveAttribute('data-rank', 'K')
    expect(kings).toHaveAttribute('data-canasta')
    expect(screen.getByRole('img', { name: 'Red 3s: 1' })).toHaveAttribute('data-red3s')
  })

  it('keeps each chip\u2019s cards in a popup you can focus to see', () => {
    const melds = [
      { id: 'm1', rank: '9' as const, cards: ['9c', '9d', '2s'].map((c, i) => card(c, i + 1)) },
    ]
    render(<MeldList melds={melds} red3s={[]} chips />)
    const nines = screen.getByRole('img', { name: '9s: 3 cards' })
    expect(nines).toHaveAttribute('tabindex', '0')
    const peek = nines.querySelector('[aria-hidden="true"]')!
    expect(peek.querySelectorAll('[data-card-id]')).toHaveLength(3)
    expect(peek.querySelector('[data-card-id="3"]')).toHaveTextContent('2')
  })
})
