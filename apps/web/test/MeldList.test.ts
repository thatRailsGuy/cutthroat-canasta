import { describe, expect, it } from 'vitest'
import { canastaTopCard } from '../src/components/MeldList'
import { card } from './fixtures'

const meldOf = (codes: string[]) => ({
  id: 'm1',
  rank: 'Q' as const,
  cards: codes.map((code, i) => card(code, i + 1)),
})

describe('canastaTopCard', () => {
  it('shows a red card of the rank on a clean canasta', () => {
    const top = canastaTopCard(meldOf(['Qs', 'Qc', 'Qs', 'Qh', 'Qc', 'Qs', 'Qc']))
    expect(top).toMatchObject({ rank: 'Q', suit: 'hearts' })
  })

  it('shows a black card of the rank on a dirty canasta', () => {
    const top = canastaTopCard(meldOf(['Qh', 'Qd', 'Qc', 'Qh', 'Qd', '2h', 'JK']))
    expect(top).toMatchObject({ rank: 'Q', suit: 'clubs' })
  })

  it('stands in a card of the right colour when the meld has none', () => {
    const top = canastaTopCard(meldOf(['Qh', 'Qd', 'Qh', 'Qd', 'Qh', '2c', 'JK']))
    expect(top).toMatchObject({ rank: 'Q', suit: 'spades' })
  })
})
