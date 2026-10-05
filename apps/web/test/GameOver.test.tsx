import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { GameOver, type GameOverProps } from '../src/components/GameOver'
import { makeView } from './fixtures'

/** You and Bob at game over; Bob won. */
function renderGameOver(props: Partial<GameOverProps> = {}) {
  const view = { ...makeView({ hand: [], phase: 'draw' }), status: 'gameOver' as const }
  view.winners = ['bob']
  const onPlayAgain = vi.fn()
  render(
    <MemoryRouter>
      <GameOver
        view={view}
        playerId="you"
        hostId="you"
        connected={['you', 'bob']}
        offline={false}
        onPlayAgain={onPlayAgain}
        {...props}
      />
    </MemoryRouter>,
  )
  return { onPlayAgain }
}

describe('GameOver', () => {
  it('names the winner and offers a way back to the main menu', () => {
    renderGameOver()
    expect(screen.getByRole('heading', { name: 'Bob wins!' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Main menu' })).toHaveAttribute('href', '/')
  })

  it('lets the host play again, and shows who is still here', async () => {
    const { onPlayAgain } = renderGameOver({ connected: ['you'] })
    const here = screen.getByRole('list', { name: 'Still here' })
    expect(
      within(here)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['You'])
    await userEvent.click(screen.getByRole('button', { name: 'Play again' }))
    expect(onPlayAgain).toHaveBeenCalled()
  })

  it('has everyone else wait for the host', () => {
    renderGameOver({ hostId: 'bob' })
    expect(screen.queryByRole('button', { name: 'Play again' })).toBeNull()
    expect(screen.getByText('Waiting for Bob (host) to start another game.')).toBeInTheDocument()
  })

  it('lets anyone play again while the host is away', () => {
    renderGameOver({ hostId: 'bob', connected: ['you'] })
    expect(screen.getByRole('button', { name: 'Play again' })).toBeEnabled()
  })

  it('can’t play again while offline', () => {
    renderGameOver({ offline: true })
    expect(screen.getByRole('button', { name: 'Play again' })).toBeDisabled()
  })
})
