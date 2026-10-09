import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ScorePad } from '../src/components/ScorePad'
import { makeView } from './fixtures'

const breakdown = (total: number) => ({
  meldPoints: total,
  canastaBonus: 0,
  red3Points: 0,
  goingOutBonus: 0,
  concealedBonus: 0,
  handPenalty: 0,
  total,
})

describe('ScorePad', () => {
  it('writes one line per round and underlines the leader’s total', () => {
    const view = makeView({ hand: [], phase: 'draw' })
    view.players[0].score = 400
    view.players[1].score = 650
    view.history = [
      {
        round: 1,
        endedBy: 'goingOut',
        wentOut: 'bob',
        breakdown: { you: breakdown(400), bob: breakdown(650) },
        hands: {},
      },
    ]
    render(<ScorePad view={view} onOpenSheet={vi.fn()} />)
    expect(within(screen.getByRole('row', { name: 'Round 1' })).getByText('650')).toBeVisible()
    const totals = within(screen.getByRole('row', { name: 'Totals' }))
    expect(totals.getByText('650').className).toMatch(/leader/)
    expect(totals.getByText('400').className).not.toMatch(/leader/)
  })

  it('says so before any round is scored', () => {
    render(<ScorePad view={makeView({ hand: [], phase: 'draw' })} onOpenSheet={vi.fn()} />)
    expect(screen.getByText('No rounds yet')).toBeInTheDocument()
  })

  it('lists players down the pad at a crowded table', () => {
    const view = makeView({ hand: [], phase: 'draw' })
    view.players = ['Ann', 'Ben', 'Cara', 'Dee', 'Eve'].map((name, i) => ({
      ...view.players[0],
      id: name.toLowerCase(),
      name,
      score: 100 * (i + 1),
    }))
    view.history = [
      {
        round: 1,
        endedBy: 'goingOut',
        wentOut: 'eve',
        breakdown: Object.fromEntries(view.players.map((p) => [p.id, breakdown(p.score)])),
        hands: {},
      },
    ]
    render(<ScorePad view={view} onOpenSheet={vi.fn()} />)
    const eve = within(screen.getByRole('row', { name: /^Eve\b/ }))
    expect(eve.getAllByText('500')).toHaveLength(2)
    expect(eve.getAllByText('500')[1].className).toMatch(/leader/)
    expect(screen.getByRole('columnheader', { name: 'Rd 1' })).toBeInTheDocument()
  })
})
