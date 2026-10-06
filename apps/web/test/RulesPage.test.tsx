import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { RulesPage } from '../src/pages/RulesPage'

describe('RulesPage', () => {
  it('ends with the sound credits, listed last in the contents', () => {
    render(
      <MemoryRouter>
        <RulesPage />
      </MemoryRouter>,
    )
    const contents = within(screen.getByRole('navigation', { name: 'Contents' }))
    expect(contents.getAllByRole('link').at(-1)).toHaveAttribute('href', '#sound-credits')
    const credits = within(screen.getByRole('region', { name: 'Sound credits' }))
    expect(credits.getByRole('link', { name: 'Restaurant Bell' })).toHaveAttribute(
      'href',
      'https://freesound.org/people/Diego25/sounds/394625/',
    )
    expect(credits.getAllByRole('link', { name: 'CC BY 4.0' })).toHaveLength(3)
  })
})
