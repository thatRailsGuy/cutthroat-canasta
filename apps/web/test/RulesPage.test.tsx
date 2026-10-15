import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { RulesPage } from '../src/pages/RulesPage'
import { RulesDrawerContext } from '../src/rules/drawer'
import { RulesContent } from '../src/rules/RulesContent'

const HOUSE_RULES = "For Canasta players: what's different here"

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
    expect(credits.getAllByRole('link', { name: 'CC BY 4.0' })).toHaveLength(4)
  })

  it('lists the house rules under the quick reference, each linked to its full rule', () => {
    render(
      <MemoryRouter>
        <RulesPage />
      </MemoryRouter>,
    )
    const contents = within(screen.getByRole('navigation', { name: 'Contents' }))
    expect(
      contents
        .getAllByRole('link')
        .slice(0, 2)
        .map((l) => l.getAttribute('href')),
    ).toEqual(['#quick-reference', '#house-rules'])

    const house = within(screen.getByRole('region', { name: HOUSE_RULES }))
    expect(house.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Here',
      'Standard Canasta',
      'Full rule',
    ])
    // A heading row for each group, then its differences.
    expect(house.getAllByRole('rowheader')).toHaveLength(4 + 12)
    for (const group of ['At the table', 'Melds', 'The pile', 'Ending the round and scoring']) {
      expect(house.getByRole('rowheader', { name: group })).toHaveAttribute('scope', 'rowgroup')
    }
    const wilds = within(house.getByRole('row', { name: /Wilds may not outnumber naturals/ }))
    expect(wilds.getByRole('link', { name: 'Melds and canastas' })).toHaveAttribute(
      'href',
      '#melds',
    )
    const concealed = within(house.getByRole('row', { name: /Going out concealed/ }))
    expect(concealed.getByRole('rowheader')).toHaveTextContent(
      'Going out concealed earns 300 (100 + 200 bonus)',
    )
    expect(concealed.getByRole('link', { name: 'Scoring' })).toHaveAttribute('href', '#scoring')
    expect(house.getByRole('link', { name: 'Play the practice hand' })).toHaveAttribute(
      'href',
      '/learn',
    )
  })
})

describe('the house rules in the rules drawer', () => {
  it('scroll the drawer to the full rule, and leave out the practice hand', async () => {
    const openRules = vi.fn()
    render(
      <MemoryRouter>
        <RulesDrawerContext.Provider value={openRules}>
          <RulesContent />
        </RulesDrawerContext.Provider>
      </MemoryRouter>,
    )
    const house = within(screen.getByRole('region', { name: HOUSE_RULES }))
    const pile = within(house.getByRole('row', { name: /A finished canasta cannot take/ }))
    await userEvent.click(pile.getByRole('link', { name: 'Picking up the pile' }))
    expect(openRules).toHaveBeenCalledWith('pickup')
    expect(house.queryByRole('link', { name: 'Play the practice hand' })).not.toBeInTheDocument()
  })
})
