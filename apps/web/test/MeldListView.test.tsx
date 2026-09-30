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
})
