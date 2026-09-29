import { RULES_EXAMPLES } from '@canasta/engine/examples'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RuleExample } from '../src/rules/RuleExample'

describe('RuleExample', () => {
  it.each(RULES_EXAMPLES.filter((e) => e.kind !== 'scoring').map((e) => [e.id, e] as const))(
    '%s shows its verdict and its cards',
    (_, example) => {
      const { container } = render(<RuleExample example={example} />)
      const figure = within(container.querySelector('figure')!)
      expect(figure.getByText(example.title)).toBeInTheDocument()
      expect(
        figure.getByText(example.expected === null ? 'Legal' : 'Not allowed'),
      ).toBeInTheDocument()
      expect(figure.getAllByRole('img').length).toBeGreaterThanOrEqual(1)
    },
  )

  it('shows every player’s breakdown for a scoring example', () => {
    const example = RULES_EXAMPLES.find((e) => e.id === 'scoring-round')!
    render(<RuleExample example={example} />)
    const total = screen.getByRole('row', { name: /Round total/ })
    expect(
      within(total)
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual(['1195', '190', '-120'])
    expect(screen.getByRole('row', { name: /Cards left in hand/ })).toHaveTextContent('-25')
  })
})
