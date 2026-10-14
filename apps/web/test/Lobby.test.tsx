import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Lobby, type LobbyProps } from '../src/pages/Lobby'
import { makeView } from './fixtures'

function setup(overrides: Partial<LobbyProps> = {}) {
  const view = { ...makeView({ hand: [], phase: 'draw' }), status: 'lobby' as const }
  const props: LobbyProps = {
    code: 'HT7KM4',
    view,
    playerId: 'you',
    hostId: 'you',
    connected: ['you', 'bob'],
    isPublic: false,
    kicked: [],
    chat: [],
    offline: false,
    send: vi.fn(() => true),
    talk: { text: '', onType: vi.fn(), onSend: vi.fn(() => true), onRead: vi.fn() },
    ...overrides,
  }
  render(<Lobby {...props} />)
  return props
}

describe('Lobby', () => {
  it('lets the host list the room', async () => {
    const { send } = setup()
    const toggle = screen.getByRole('switch', { name: 'Private' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(toggle)
    expect(send).toHaveBeenCalledWith({ type: 'setPublic', public: true })
  })

  it('tells the host where a public room is listed', () => {
    setup({ isPublic: true })
    expect(screen.getByRole('switch', { name: 'Public' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText(/Listed on the home page as "You's table"/)).toBeInTheDocument()
  })

  it('shows other players a chip in place of the switch', () => {
    setup({ hostId: 'bob', isPublic: true })
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    expect(screen.getByText('● Public table')).toBeInTheDocument()
  })

  it('shows no chip in a private room', () => {
    setup({ hostId: 'bob' })
    expect(screen.queryByText('● Public table')).not.toBeInTheDocument()
  })

  it('keeps the QR code', () => {
    setup()
    expect(screen.getByRole('img', { name: /QR code/ })).toBeInTheDocument()
  })

  it('tells the host a kicked player stays out', async () => {
    const { send } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Kick' }))
    expect(send).toHaveBeenCalledWith({ type: 'kick', playerId: 'bob' })
    expect(screen.getByText("You kicked Bob. They can't join this game again.")).toBeInTheDocument()
  })

  it('lets the host undo a kick', async () => {
    const { send } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Kick' }))
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(send).toHaveBeenLastCalledWith({ type: 'unkick', playerId: 'bob' })
    expect(screen.getByText('Bob can join again with the code or link.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
  })

  it('lists kicked players for the host to let back in', async () => {
    const { send } = setup({ kicked: [{ playerId: 'dave', name: 'Dave' }] })
    const list = screen.getByRole('region', { name: 'Kicked' })
    expect(list).toHaveTextContent('Dave')
    await userEvent.click(screen.getByRole('button', { name: 'Let back in' }))
    expect(send).toHaveBeenCalledWith({ type: 'unkick', playerId: 'dave' })
  })

  it('shows the Kicked list only to the host', () => {
    setup({ hostId: 'bob', kicked: [{ playerId: 'dave', name: 'Dave' }] })
    expect(screen.queryByRole('region', { name: 'Kicked' })).not.toBeInTheDocument()
  })

  it('waits for a host who is here', () => {
    setup({ hostId: 'bob' })
    expect(screen.getByText('Waiting for the host to start.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start game' })).not.toBeInTheDocument()
    expect(screen.queryByText(/If you start the game/)).not.toBeInTheDocument()
  })

  it('lets a player start for an away host', async () => {
    const { send } = setup({ hostId: 'bob', connected: ['you'] })
    expect(
      screen.getByText(
        "Bob is the host, but they're away. If you start the game, you become the host.",
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText('Waiting for the host to start.')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Start game' }))
    expect(send).toHaveBeenCalledWith({ type: 'start' })
  })

  it('lets a player start when there is no host', () => {
    setup({ hostId: null })
    expect(
      screen.getByText('The host is away. If you start the game, you become the host.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start game' })).toBeInTheDocument()
  })

  it('keeps Kick and the switch host-only while the host is away', () => {
    setup({ hostId: 'bob', connected: ['you'] })
    expect(screen.queryByRole('button', { name: 'Kick' })).not.toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })

  it('tells the host nothing about standing in', () => {
    setup()
    expect(screen.queryByText(/If you start the game/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start game' })).toBeInTheDocument()
  })
})
