import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { GameOver } from '../src/components/GameOver'
import { makeView } from './fixtures'

describe('GameOver', () => {
  it('names the winner and offers a way back to the main menu', () => {
    const view = { ...makeView({ hand: [], phase: 'draw' }), status: 'gameOver' as const }
    view.winners = ['bob']
    render(
      <MemoryRouter>
        <GameOver view={view} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Bob wins!' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Main menu' })).toHaveAttribute('href', '/')
  })
})
