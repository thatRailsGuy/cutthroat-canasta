import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { initialGameState, type GameState } from '../src/gameState'
import { GamePage } from '../src/pages/GamePage'
import styles from '../src/pages/Pages.module.css'
import { makeView } from './fixtures'

const { game } = vi.hoisted(() => ({ game: { state: null as GameState | null } }))
vi.mock('../src/api', async (original) => ({
  ...(await original<typeof import('../src/api')>()),
  gameExists: () => Promise.resolve(true),
}))
vi.mock('../src/useGame', () => ({
  useGame: () => ({
    state: game.state,
    join: vi.fn(),
    send: vi.fn(() => true),
    typeChat: vi.fn(),
    sendChat: vi.fn(() => true),
    readChat: vi.fn(),
    dismissToast: vi.fn(),
  }),
}))

async function page(state: Partial<GameState>) {
  game.state = { ...initialGameState, ...state }
  render(
    <MemoryRouter initialEntries={['/g/HT7KM4']}>
      <Routes>
        <Route path="/g/:code" element={<GamePage />} />
      </Routes>
    </MemoryRouter>,
  )
  return screen.findByRole('button', { name: 'Rules' })
}

describe('GamePage', () => {
  it('starts the join form and the connection banner below the fixed Rules button', async () => {
    await page({ connection: 'connecting' })
    const form = screen.getByRole('heading', { name: 'Join game HT7KM4' }).closest('main')
    expect(styles.belowTools).toBeTruthy()
    expect(form?.parentElement).toHaveClass(styles.belowTools)
    expect(screen.getByText('Connecting…', { selector: 'p' }).parentElement).toBe(
      form?.parentElement,
    )
  })

  it('starts the lobby below the fixed Rules button', async () => {
    const view = { ...makeView({ hand: [], phase: 'draw' }), status: 'lobby' as const }
    await page({ connection: 'open', playerId: 'you', hostId: 'you', view })
    const lobby = document.querySelector(`.${styles.lobby}`)
    expect(lobby?.parentElement).toHaveClass(styles.belowTools)
  })

  it('leaves the table to clear the buttons itself', async () => {
    await page({ connection: 'open', playerId: 'you', view: makeView({ hand: [], phase: 'draw' }) })
    expect(document.querySelector(`.${styles.belowTools}`)).toBeNull()
  })
})
