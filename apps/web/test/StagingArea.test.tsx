import type { Action, PlayerView } from '@canasta/engine'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { CenterPile } from '../src/components/CenterPile'
import { Hand } from '../src/components/Hand'
import { MeldList } from '../src/components/MeldList'
import { StagingArea } from '../src/components/StagingArea'
import { stagedIds, useStaging } from '../src/staging'
import { card, makeView } from './fixtures'

/** The table's staging wiring: hand, your melds, the pile, and the staging area. */
function Harness({ view, onAction }: { view: PlayerView; onAction: (action: Action) => boolean }) {
  const [staging, dispatch] = useStaging(view)
  return (
    <MemoryRouter>
      <CenterPile
        view={view}
        yourTurn
        selected={staging.selected}
        staged={stagedIds(staging)}
        onToggleTop={(cardId) => dispatch({ type: 'toggle', cardId })}
        onDraw={() => {}}
      />
      <MeldList
        melds={view.you!.melds}
        red3s={[]}
        onPick={(meldId) => dispatch({ type: 'stageAdd', meldId })}
      />
      <StagingArea view={view} staging={staging} dispatch={dispatch} onAction={onAction} />
      <Hand
        cards={view.you!.hand}
        selected={staging.selected}
        hidden={stagedIds(staging)}
        onToggle={(cardId) => dispatch({ type: 'toggle', cardId })}
      />
    </MemoryRouter>
  )
}

/** `sent`: what sending an action returns (false while the socket is down). */
function setup(view: PlayerView, sent = true) {
  const onAction = vi.fn<(action: Action) => boolean>(() => sent)
  render(<Harness view={view} onAction={onAction} />)
  const user = userEvent.setup()
  const click = (name: string | RegExp) => user.click(screen.getByRole('button', { name }))
  return { onAction, click }
}

const button = (name: string) => screen.getByRole('button', { name })

describe('StagingArea', () => {
  it('previews an illegal meld with a Why? link and keeps Meld disabled', async () => {
    const view = makeView({
      phase: 'play',
      hand: [
        card('9h', 1),
        card('9s', 2),
        card('2c', 3),
        card('2d', 4),
        card('JK', 5),
        card('4c', 6),
      ],
      score: -100,
    })
    const { click } = setup(view)
    for (const name of [
      '9 of hearts',
      '9 of spades',
      '2 of clubs, wild',
      '2 of diamonds, wild',
      'Joker, wild',
    ]) {
      await click(name)
    }
    expect(screen.getByRole('status')).toHaveTextContent("Wild cards can't outnumber natural cards")
    expect(screen.getByRole('link', { name: 'Why?' })).toHaveAttribute('href', '/rules#melds')
    expect(button('Meld')).toBeDisabled()
  })

  it('sends a legal meld and clears the staging area', async () => {
    const view = makeView({
      phase: 'play',
      hand: [card('Ah', 1), card('As', 2), card('Ad', 3), card('4c', 4), card('5c', 5)],
    })
    const { click, onAction } = setup(view)
    await click('Ace of hearts')
    await click('Ace of spades')
    await click('Ace of diamonds')
    expect(screen.getByRole('status')).toHaveTextContent('Legal meld.')
    await click('Meld')
    expect(onAction).toHaveBeenCalledWith({
      type: 'meld',
      play: { newMelds: [[1, 2, 3]], additions: [] },
    })
    expect(screen.getByRole('status')).toHaveTextContent('Select cards from your hand.')
  })

  it('stages a new meld and an addition to an existing meld in one play', async () => {
    const view = makeView({
      phase: 'play',
      melds: [{ id: 'm1', rank: 'K', cards: [card('Kh', 10), card('Kd', 11), card('Ks', 12)] }],
      hand: [
        card('Kc', 1),
        card('7h', 2),
        card('7s', 3),
        card('7d', 4),
        card('4c', 5),
        card('5c', 6),
      ],
    })
    const { click, onAction } = setup(view)
    await click('King of clubs')
    await click(/Add selected cards to your Kings/)
    await click('7 of hearts')
    await click('7 of spades')
    await click('7 of diamonds')
    await click('New meld')
    expect(screen.getByText('New meld', { selector: 'span' })).toBeInTheDocument()
    await click('Meld')
    expect(onAction).toHaveBeenCalledWith({
      type: 'meld',
      play: { newMelds: [[2, 3, 4]], additions: [{ meldId: 'm1', cardIds: [1] }] },
    })
  })

  it('picks up the pile with the top discard and a natural pair', async () => {
    const view = makeView({
      phase: 'draw',
      top: card('Qh', 1),
      score: -100,
      hand: [card('Qs', 2), card('Qd', 3), card('4c', 4), card('5c', 5)],
    })
    const { click, onAction } = setup(view)
    expect(button('Pick up pile')).toBeDisabled()
    await click('Queen of hearts')
    await click('Queen of spades')
    await click('Queen of diamonds')
    await click('Pick up pile')
    expect(onAction).toHaveBeenCalledWith({
      type: 'pickUpPile',
      play: { newMelds: [[1, 2, 3]], additions: [] },
    })
  })

  it('discards a single selected card', async () => {
    const view = makeView({ phase: 'play', hand: [card('4c', 1), card('5c', 2), card('6c', 3)] })
    const { click, onAction } = setup(view)
    await click('5 of clubs')
    expect(button('Meld')).toBeDisabled()
    await click('Discard')
    expect(onAction).toHaveBeenCalledWith({ type: 'discard', cardId: 2 })
  })

  it('melds a single card onto your meld of its rank, or discards it', async () => {
    const view = makeView({
      phase: 'play',
      melds: [{ id: 'm1', rank: 'K', cards: [card('Kh', 10), card('Kd', 11), card('Ks', 12)] }],
      hand: [card('Kc', 1), card('5c', 2), card('6c', 3)],
    })
    const { click, onAction } = setup(view)
    await click('King of clubs')
    expect(screen.getByRole('status')).toHaveTextContent(
      'You can add this card to your Kings or discard it.',
    )
    expect(button('Discard')).toBeEnabled()
    await click('Meld')
    expect(onAction).toHaveBeenCalledWith({
      type: 'meld',
      play: { newMelds: [], additions: [{ meldId: 'm1', cardIds: [1] }] },
    })
  })

  it('drops staged cards that leave your hand, and the top discard after the draw phase', async () => {
    const hand = [card('Qs', 2), card('Qd', 3), card('4c', 4), card('5c', 5)]
    const drawView = makeView({ phase: 'draw', top: card('Qh', 1), score: -100, hand })
    const onAction = vi.fn<(action: Action) => boolean>(() => true)
    const { rerender } = render(<Harness view={drawView} onAction={onAction} />)
    const user = userEvent.setup()
    await user.click(button('Queen of hearts'))
    await user.click(button('Queen of spades'))
    await user.click(button('New meld'))
    await user.click(button('4 of clubs'))

    // Someone else's discard came in; now it's your play phase, and the 4 of clubs is gone.
    const playView = makeView({
      phase: 'play',
      top: card('9c', 50),
      score: -100,
      hand: [card('Qs', 2), card('Qd', 3), card('5c', 5), card('6c', 6)],
    })
    rerender(<Harness view={playView} onAction={onAction} />)
    const staged = within(screen.getByRole('region', { name: 'Staging area' }))
    expect(staged.queryByRole('button', { name: 'Queen of hearts' })).toBeNull()
    expect(staged.getByRole('button', { name: 'Queen of spades' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '4 of clubs' })).toBeNull()
    expect(button('Clear')).toBeEnabled()
  })

  it('keeps the staging when the action could not be sent', async () => {
    const view = makeView({ phase: 'play', hand: [card('4c', 1), card('5c', 2), card('6c', 3)] })
    const { click, onAction } = setup(view, false)
    await click('5 of clubs')
    await click('Discard')
    expect(onAction).toHaveBeenCalledWith({ type: 'discard', cardId: 2 })
    expect(button('5 of clubs')).toHaveAttribute('aria-pressed', 'true')
    expect(button('Discard')).toBeEnabled()
  })

  it('disables the action buttons while offline', () => {
    const view = makeView({ phase: 'play', hand: [card('4c', 1), card('5c', 2)] })
    render(
      <MemoryRouter>
        <StagingArea
          view={view}
          staging={{ selected: [2], groups: [] }}
          offline
          dispatch={() => {}}
          onAction={() => true}
        />
      </MemoryRouter>,
    )
    expect(screen.getByRole('status')).toHaveTextContent('You can discard this card.')
    expect(button('Discard')).toBeDisabled()
  })

  it('marks a staged top discard in the pile', async () => {
    const view = makeView({
      phase: 'draw',
      top: card('Qh', 1),
      hand: [card('Qs', 2), card('4c', 4)],
    })
    const { click } = setup(view)
    await click('Queen of hearts')
    await click('New meld')
    const pile = within(screen.getByRole('region', { name: 'Stock and discard pile' }))
    expect(pile.getByText('In the staging area')).toBeInTheDocument()
    expect(pile.getByRole('img', { name: 'Queen of hearts' })).toBeInTheDocument()
  })

  it('forgets a staged top discard for good once the draw phase ends', async () => {
    const hand = [card('Qs', 2), card('4c', 4), card('5c', 5)]
    const drawView = makeView({ phase: 'draw', top: card('Qh', 1), hand })
    const onAction = vi.fn<(action: Action) => boolean>(() => true)
    const { rerender } = render(<Harness view={drawView} onAction={onAction} />)
    const user = userEvent.setup()
    await user.click(button('Queen of hearts'))
    await user.click(button('New meld'))

    // You drew instead; the same Queen is still on top during your play phase, then again later.
    rerender(
      <Harness view={makeView({ phase: 'play', top: card('Qh', 1), hand })} onAction={onAction} />,
    )
    rerender(<Harness view={drawView} onAction={onAction} />)
    const staged = within(screen.getByRole('region', { name: 'Staging area' }))
    expect(staged.queryByRole('button', { name: 'Queen of hearts' })).toBeNull()
    expect(button('Queen of hearts')).toHaveAttribute('aria-pressed', 'false')
  })

  it('clears the selection', async () => {
    const view = makeView({ phase: 'play', hand: [card('4c', 1), card('5c', 2)] })
    const { click } = setup(view)
    await click('4 of clubs')
    expect(button('4 of clubs')).toHaveAttribute('aria-pressed', 'true')
    await click('Clear')
    expect(button('4 of clubs')).toHaveAttribute('aria-pressed', 'false')
    expect(button('Clear')).toBeDisabled()
  })
})
