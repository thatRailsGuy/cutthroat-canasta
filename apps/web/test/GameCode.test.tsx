import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GameCode } from '../src/components/GameCode'

describe('GameCode', () => {
  it('puts each character on a tile, in two groups of three', () => {
    const { container } = render(<GameCode code="WM7KR4" />)
    const tiles = container.querySelectorAll('[aria-hidden="true"] > span')
    expect([...tiles].map((t) => t.textContent)).toEqual(['W', 'M', '7', '', 'K', 'R', '4'])
  })

  it('spells the code out for a screen reader', () => {
    render(<GameCode code="WM7KR4" />)
    expect(screen.getByText('W M 7 K R 4')).toBeInTheDocument()
  })
})
