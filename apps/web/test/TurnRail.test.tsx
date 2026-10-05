import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TurnRail } from '../src/components/TurnRail'
import { makeView } from './fixtures'

function fourSeats() {
  const view = makeView({ hand: [], phase: 'draw' })
  const other = (id: string, name: string) => ({ ...view.players[1], id, name })
  view.players = [
    other('mabel', 'Mabel'),
    view.players[0],
    other('otis', 'Otis'),
    other('dot', 'Dot'),
  ]
  view.round = { ...view.round!, dealer: 0, current: 2 }
  return view
}

describe('TurnRail', () => {
  it('starts with you and marks who is playing, who is next, and who dealt', () => {
    render(<TurnRail view={fourSeats()} />)
    const stops = within(screen.getByRole('list', { name: 'Turn order' })).getAllByRole('listitem')
    expect(stops.map((s) => s.textContent)).toEqual([
      'YYou',
      'OOtisPlaying',
      'DDotNext',
      'MDMabelDealer',
    ])
    expect(stops[1]).toHaveAttribute('aria-current', 'step')
  })

  it('marks no one as playing once the round is over', () => {
    const view = fourSeats()
    view.status = 'roundOver'
    render(<TurnRail view={view} />)
    const list = screen.getByRole('list', { name: 'Turn order' })
    expect(within(list).queryByText('Playing')).not.toBeInTheDocument()
    expect(within(list).queryByText('Next')).not.toBeInTheDocument()
    expect(within(list).getByText('Dealer')).toBeInTheDocument()
  })

  it('draws a crowded table as a loop, and still lists the seats in play order', () => {
    const view = fourSeats()
    const other = (id: string, name: string) => ({ ...view.players[1], id, name })
    view.players.push(other('hank', 'Hank'), other('june', 'June'))
    const { container } = render(<TurnRail view={view} />)
    const stops = within(screen.getByRole('list', { name: 'Turn order' })).getAllByRole('listitem')
    expect(stops.map((s) => s.textContent)).toEqual([
      'You',
      'Otis: Playing',
      'Dot: Next',
      'Hank',
      'June',
      'Mabel: Dealer',
    ])
    // You sit between the players after and before you; the rest go across the top.
    const rows = [...container.querySelectorAll('[aria-hidden="true"] > div')].map((row) =>
      [...row.children].map((c) => c.textContent).filter(Boolean),
    )
    expect(rows).toEqual([
      ['DDotNext', 'HHank', 'JJune'],
      ['OOtisPlaying', 'YYou', 'MDMabelDealer'],
    ])
  })

  it('shows a player who joined mid-hand in the seat they take next hand, marked as waiting', () => {
    const view = fourSeats()
    view.waiting = [{ id: 'zed', name: 'Zed' }]
    render(<TurnRail view={view} />)
    const stops = within(screen.getByRole('list', { name: 'Turn order' })).getAllByRole('listitem')
    expect(stops.map((s) => s.textContent)).toEqual([
      'You',
      'Otis: Playing',
      'Dot: Next',
      'Zed: Waiting · next hand',
      'Mabel: Dealer',
    ])
  })

  it('starts with the waiting player on their own rail', () => {
    const view = fourSeats()
    view.you = null
    view.players[1] = { ...view.players[1], name: 'Pat' }
    view.waiting = [{ id: 'zed', name: 'Zed' }]
    render(<TurnRail view={view} playerId="zed" />)
    const stops = within(screen.getByRole('list', { name: 'Turn order' })).getAllByRole('listitem')
    expect(stops.map((s) => s.textContent)).toEqual([
      'You: Waiting · next hand',
      'Mabel: Dealer',
      'Pat',
      'Otis: Playing',
      'Dot: Next',
    ])
  })
})
