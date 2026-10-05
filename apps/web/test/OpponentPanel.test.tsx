import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { OpponentPanel, type OpponentPanelProps } from '../src/components/OpponentPanel'
import { makeView } from './fixtures'

const bob = makeView({ hand: [], phase: 'draw' }).players[1]

function setup(overrides: Partial<OpponentPanelProps> = {}) {
  return render(
    <OpponentPanel
      player={bob}
      seat={1}
      isTurn={false}
      isConnected
      isHost={false}
      playing
      {...overrides}
    />,
  )
}

describe('OpponentPanel', () => {
  it('shows a labelled chip when the pile is frozen for the player', () => {
    setup({ pileFrozen: true })
    expect(screen.getByText('Pile frozen')).toHaveAttribute('title', 'The pile is frozen for Bob')
    expect(screen.getByRole('region', { name: 'Bob, pile frozen' })).toBeInTheDocument()
  })

  it('shows a snowflake on the avatar instead on a crowded panel', () => {
    setup({ pileFrozen: true, crowded: true })
    expect(screen.queryByText('Pile frozen')).toBeNull()
    expect(screen.getByTitle('The pile is frozen for this player')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Bob, pile frozen' })).toBeInTheDocument()
  })

  it('shows no marker once the pile has thawed for the player', () => {
    setup()
    expect(screen.queryByText('Pile frozen')).toBeNull()
    expect(screen.queryByTitle('The pile is frozen for this player')).toBeNull()
  })
})
