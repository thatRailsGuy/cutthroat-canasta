import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TutorialPage } from '../src/tutorial/TutorialPage'

afterEach(() => {
  vi.useRealTimers()
})

function setup() {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const { container } = render(
    <MemoryRouter>
      <TutorialPage />
    </MemoryRouter>,
  )
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const lesson = () => within(screen.getByRole('region', { name: 'Lesson' }))
  const title = () => lesson().getByRole('heading').textContent
  /** The first card in your hand with this name, among any duplicates from the second deck. */
  const card = (name: string) =>
    within(screen.getByRole('region', { name: 'You' })).getAllByRole('button', { name })[0]
  const click = (el: Element) => user.click(el)
  const button = (name: string) => screen.getByRole('button', { name })
  const stock = () => container.querySelector<HTMLButtonElement>('[data-stock]')!
  return { user, lesson, title, card, click, button, stock }
}

describe('TutorialPage', () => {
  it('walks you through your first turn and plays Dot', async () => {
    const { lesson, title, card, click, button, stock } = setup()
    expect(title()).toBe('Welcome to the table')

    await click(stock())
    expect(lesson().getByRole('status')).toHaveTextContent('Read this step, then click Next.')

    await click(lesson().getByRole('button', { name: 'Next' }))
    await click(lesson().getByRole('button', { name: 'Next' }))
    expect(title()).toBe('Draw a card')
    await click(stock())
    expect(title()).toBe('Make your first meld')

    await click(card('Ace of hearts'))
    await click(card('Ace of spades'))
    await click(card('Ace of diamonds'))
    await click(button('Meld'))
    expect(title()).toBe('Discard to end your turn')

    await click(card('King of spades'))
    await click(button('Discard'))
    expect(lesson().getByRole('status')).toHaveTextContent('For this lesson, discard the 4♣.')
    await click(button('Clear'))

    await click(card('4 of clubs'))
    await click(button('Discard'))
    expect(title()).toBe("Dot's turn")

    // Dot draws, melds, and discards: one pause each.
    for (let move = 0; move < 3; move++) await act(() => vi.advanceTimersByTimeAsync(1200))
    expect(title()).toBe('Pick up the pile')
  })
})
