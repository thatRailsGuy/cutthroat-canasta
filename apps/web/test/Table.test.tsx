import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import type { ChatLine } from '@canasta/server/protocol'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { initialGameState } from '../src/gameState'
import { Table } from '../src/pages/Table'
import { card, makeView } from './fixtures'

/** Zed joined mid-hand: no seat, no hand, waiting for the next deal. */
function watching() {
  const view = makeView({ hand: [], phase: 'draw' })
  view.you = null
  view.waiting = [{ id: 'zed', name: 'Zed' }]
  const state = { ...initialGameState, playerId: 'zed', view, connection: 'open' as const }
  const send = vi.fn(() => true)
  render(
    <MemoryRouter>
      <Table code="HT7KM4" view={view} state={state} send={send} />
    </MemoryRouter>,
  )
  return { send }
}

describe('Table, for a player waiting for the next hand', () => {
  it('shows the table with everyone as an opponent, and no hand', () => {
    watching()
    expect(screen.getByRole('region', { name: /^You,/ })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /^Bob/ })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Your hand' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Quit game' })).toBeNull()
  })

  it('says when they are dealt in, and lets them leave', async () => {
    const { send } = watching()
    const note = screen.getByRole('region', { name: 'You' })
    expect(within(note).getByRole('heading')).toHaveTextContent('Pull up a chair, Zed')
    expect(note).toHaveTextContent("you'll play after Bob")
    await userEvent.click(within(note).getByRole('button', { name: 'Leave' }))
    expect(send).toHaveBeenCalledWith({ type: 'leave' })
  })

  it('pencils them into the score pad at 0', () => {
    watching()
    const pad = screen.getByRole('region', { name: 'Score pad' })
    expect(within(pad).getByTitle('Zed, dealt in next hand')).toBeInTheDocument()
  })
})

describe('Table, on a phone', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const line = (id: number, playerId: string): ChatLine => ({
    id,
    playerId,
    name: playerId === 'bob' ? 'Bob' : 'You',
    text: `line ${id}`,
    at: id,
    anchor: { game: 1, round: 1, redeals: 0, after: 0 },
  })

  it('counts unread chat on the Scores button until the sheet opens', async () => {
    vi.stubGlobal(
      'matchMedia',
      (query: string) =>
        ({
          matches: query.includes('max-width'),
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    )
    const view = makeView({ hand: [], phase: 'draw' })
    const state = {
      ...initialGameState,
      playerId: 'you',
      view,
      connection: 'open' as const,
      chat: [line(1, 'bob'), line(2, 'you'), line(3, 'bob')],
      chatSeen: 0,
    }
    const onRead = vi.fn()
    render(
      <MemoryRouter>
        <Table
          code="HT7KM4"
          view={view}
          state={state}
          send={vi.fn(() => true)}
          talk={{ text: '', onType: vi.fn(), onSend: vi.fn(() => true), onRead }}
        />
      </MemoryRouter>,
    )
    expect(onRead).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Scores, 2 unread' }))
    expect(onRead).toHaveBeenCalled()
  })
})

describe('Table, skip link', () => {
  it('jumps from the top of the page to your hand', async () => {
    const view = makeView({ hand: [card('Kh', 1), card('7s', 2)], phase: 'play' })
    const state = { ...initialGameState, playerId: 'you', view, connection: 'open' as const }
    render(
      <MemoryRouter>
        <Table code="HT7KM4" view={view} state={state} send={vi.fn(() => true)} />
      </MemoryRouter>,
    )
    await userEvent.tab()
    expect(screen.getByRole('link', { name: 'Skip to your hand' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    const hand = within(screen.getByRole('region', { name: 'Your hand' }))
    expect(hand.getByRole('button', { name: 'King of hearts' })).toHaveFocus()
  })
})

describe('Table, while the host is away', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  function seated(connected: string[], awaySince: Record<string, number> = {}) {
    const view = makeView({ hand: [], phase: 'draw' })
    const state = {
      ...initialGameState,
      playerId: view.you!.id,
      hostId: 'bob',
      connected,
      awaySince,
      view,
      connection: 'open' as const,
    }
    render(
      <MemoryRouter>
        <Table code="HT7KM4" view={view} state={state} send={vi.fn(() => true)} />
      </MemoryRouter>,
    )
  }

  it('lets another player open the host tools to stand in', () => {
    seated(['you'], { bob: Date.now() - 60_000 })
    expect(screen.getByRole('button', { name: 'Host is away' })).toBeInTheDocument()
  })

  it("waits out the host's grace before offering to stand in", () => {
    vi.useFakeTimers({ now: 10_000_000, toFake: ['Date', 'setInterval', 'clearInterval'] })
    seated(['you'], { bob: Date.now() - 10_000 })
    expect(screen.queryByRole('button', { name: 'Host is away' })).toBeNull()
    act(() => vi.advanceTimersByTime(30_000))
    expect(screen.getByRole('button', { name: 'Host is away' })).toBeInTheDocument()
  })

  it('offers nothing while the host is here', () => {
    seated(['you', 'bob'])
    expect(screen.queryByRole('button', { name: 'Host is away' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Host' })).toBeNull()
  })
})

describe('Table, for a waiting player while a seat is away', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  function waitingWhileBobAway(awayFor: number) {
    vi.useFakeTimers({ now: 10_000_000, toFake: ['Date'] })
    const view = makeView({ hand: [], phase: 'draw' })
    view.you = null
    view.waiting = [{ id: 'zed', name: 'Zed' }]
    const state = {
      ...initialGameState,
      playerId: 'zed',
      view,
      connected: ['you', 'zed'],
      awaySince: { bob: Date.now() - awayFor },
      connection: 'open' as const,
    }
    const send = vi.fn(() => true)
    render(
      <MemoryRouter>
        <Table code="HT7KM4" view={view} state={state} send={send} />
      </MemoryRouter>,
    )
    return { send }
  }

  it("offers the seat once it's been away 2 minutes, and asks before taking it", async () => {
    const { send } = waitingWhileBobAway(3 * 60_000)
    const note = screen.getByRole('region', { name: 'You' })
    expect(note).toHaveTextContent('Bob away for 3 minutes')
    const user = userEvent.setup()
    await user.click(within(note).getByRole('button', { name: "Take Bob's seat…" }))
    const confirm = screen.getByRole('alertdialog', { name: "Take Bob's seat?" })
    expect(within(confirm).getByRole('button', { name: 'Keep watching' })).toHaveFocus()
    await user.click(within(confirm).getByRole('button', { name: 'Take the seat' }))
    expect(send).toHaveBeenCalledWith({ type: 'takeOver', playerId: 'bob' })
  })

  it('offers nothing while the seat has only just gone', () => {
    waitingWhileBobAway(60_000)
    expect(screen.queryByRole('button', { name: "Take Bob's seat…" })).toBeNull()
  })
})
