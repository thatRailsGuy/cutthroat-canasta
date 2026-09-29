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

  it('leaves out the freeze note when the top card itself blocks the pile', () => {
    const blocked = RULES_EXAMPLES.find((e) => e.id === 'pickup-black-3')!
    const { unmount } = render(<RuleExample example={blocked} />)
    expect(screen.queryByText(/frozen for you/i)).toBeNull()
    unmount()
    render(<RuleExample example={RULES_EXAMPLES.find((e) => e.id === 'pickup-unfrozen-wild')!} />)
    expect(screen.getByText('Not frozen for you.')).toBeInTheDocument()
  })

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
