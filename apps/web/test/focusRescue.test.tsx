import { render } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { useFocusRescue } from '../src/focusRescue'

/** A hand of three cards and a Next round button that shows once the hand is empty. */
function Board() {
  useFocusRescue()
  const [cards, setCards] = useState(['A', 'B', 'C'])
  return (
    <main>
      <section data-focus-group="hand">
        {cards.map((c) => (
          <button key={c} type="button" onClick={() => setCards(cards.filter((x) => x !== c))}>
            {c}
          </button>
        ))}
      </section>
      {cards.length === 0 && (
        <button type="button" data-focus-group="next">
          Next round
        </button>
      )}
    </main>
  )
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('useFocusRescue', () => {
  it('moves focus to the card that took the place of the one that went', async () => {
    const { getByRole } = render(<Board />)
    getByRole('button', { name: 'B' }).focus()
    getByRole('button', { name: 'B' }).click()
    await flush()
    expect(document.activeElement).toBe(getByRole('button', { name: 'C' }))
  })

  it('moves focus back one place when the last card goes', async () => {
    const { getByRole } = render(<Board />)
    getByRole('button', { name: 'C' }).focus()
    getByRole('button', { name: 'C' }).click()
    await flush()
    expect(document.activeElement).toBe(getByRole('button', { name: 'B' }))
  })

  it('moves focus to Next round once the hand is empty', async () => {
    const { getByRole } = render(<Board />)
    for (const name of ['A', 'B', 'C']) {
      getByRole('button', { name }).focus()
      getByRole('button', { name }).click()
      await flush()
    }
    expect(document.activeElement).toBe(getByRole('button', { name: 'Next round' }))
  })

  it('leaves focus alone when the player has moved it elsewhere', async () => {
    const { getByRole } = render(<Board />)
    const outside = document.createElement('button')
    document.body.append(outside)
    getByRole('button', { name: 'A' }).focus()
    outside.focus()
    getByRole('button', { name: 'A' }).click()
    await flush()
    expect(document.activeElement).toBe(outside)
    outside.remove()
  })
})
